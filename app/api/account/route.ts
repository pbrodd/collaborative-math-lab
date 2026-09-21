import { accountAction, accountState } from '../../../lib/auth';
import { failure, getDatabase, payload, reply } from '../../../lib/server';

export async function GET(request: Request) {
  try {
    return reply(await accountState(await getDatabase(), request));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await payload(request);
    const result = await accountAction(await getDatabase(), request, input);
    return reply(result.data, result.cookies, result.status);
  } catch (error) {
    return failure(error);
  }
}
