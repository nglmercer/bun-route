import { type Server, type SocketAddress } from "bun";
import { type HttpMethod } from "./method";
import { BunRequest } from "./request";
import type { ResponseBuilder } from "./responseBuilder";
import type { SplitPath } from "./path";
import { QueryParam } from "./router/querybuilder";
import { PathParam } from "./router/pathparam";

export type Awaitable<T> = T | Promise<T>;
export type WebSocketData =
  | {
      createdAt?: number;
      channelId?: string;
      authToken?: string;
      [key: string]: unknown;
    }
  | undefined;
export type PathParams = string[] | Record<string, string>;

export interface Request extends BunRequest {
  pathParams?: PathParams;
  pathParam(key: string): PathParam;
  pathParam(): Record<string, PathParam>;
  httpMethod: HttpMethod;
  path: string;
  splitPath: SplitPath;
  server: Server<WebSocketData>;
  sock: SocketAddress;
  originCookies: unknown;
  cookies: {
    [key: string]: string | undefined;
  };
  upgraded?: true;
  id?: string;
  parsedBody?: unknown;
  param(key: string): QueryParam;
  param(): Record<string, QueryParam>;
  queryParams: Record<string, string>;
  query(key?: string): string | string[] | Record<string, string> | undefined;
  queries(key: string): string[];
  ip: string;
  ips: string[];
}

export type BunRequestHandler = (
  request: Request,
  server: Server<WebSocketData>,
) => Awaitable<Response>;

export type RequestMiddleware = (
  ctx: Context,
) => void | Response | Promise<void | Response>;

export type MergedRequestMiddleware = RequestMiddleware & {
  base: RequestMiddleware[];
};

export interface EndpointRoute {
  handler: RequestMiddleware;
  method: HttpMethod;
  splitPath: SplitPath;
  middlewareName?: string;
}

export interface CookieOptions {
  MaxAge?: number;
  Path?: string;
  HttpOnly?: boolean;
  Secure?: boolean;
  SameSite?: "Strict" | "Lax" | "None";
}

// Forward-declare Context to avoid circular imports.
// The actual class is in ./context.ts and extends this.
export interface Context {
  req: Request;
  res: ResponseBuilder;
  readonly data: Record<string, unknown>;
  readonly url: URL;
  readonly method: string;
  readonly headers: Headers;
  readonly path: string;

  set(key: string, value: unknown): void;
  get<T = unknown>(key: string): T;
  status(code: number): this;
  json(data: unknown, code?: number): void;
  text(body: string, code?: number): void;
  html(body: string, code?: number): void;
  redirect(url: string, code?: number): void;
  notFound(msg?: string): void;
  error(msg: string, code?: number): void;
  build(): Response;
}