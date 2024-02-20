import { ExecutionArgs, GraphQLError } from 'graphql';
import { SubscribeMessage } from '../../common';
import { Context, OperationResult } from '../../server';
import { isAsyncIterable } from '../../utils';

export function wrapAsyncIterable<T>(
  iterable: AsyncIterable<T> | AsyncIterableIterator<T>,
  onNext: (promise: Promise<IteratorResult<T>>) => Promise<IteratorResult<T>>,
): AsyncIterable<T> | AsyncIterableIterator<T> {
  function wrapIter(iterator: AsyncIterator<T>): AsyncIterator<T> {
    const wrapper: AsyncIterator<T> = {
      next: () => onNext(iterator.next()),
    };

    if (iterator.return) wrapper.return = iterator.return;
    if (iterator.throw) wrapper.throw = iterator.throw;

    return wrapper;
  }

  if ('next' in iterable) {
    return {
      ...wrapIter(iterable),
      [Symbol.asyncIterator]: () => wrapIter(iterable[Symbol.asyncIterator]()),
    };
  } else {
    return {
      [Symbol.asyncIterator]: () => wrapIter(iterable[Symbol.asyncIterator]()),
    };
  }
}

export async function handleErrors(
  _ctx: Context,
  _msg: SubscribeMessage,
  _args: ExecutionArgs,
  operationResult: OperationResult,
): Promise<OperationResult> {
  if (isAsyncIterable(operationResult)) {
    return wrapAsyncIterable(operationResult, (next) =>
      next.catch((err) =>
        Promise.resolve({
          done: false,
          value: {
            errors: [new GraphQLError(err?.message)],
          },
        }),
      ),
    );
  } else {
    return operationResult;
  }
}
