export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
}

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
  responses?: Record<string, {
    description?: string;
    content?: Record<string, {
      schema?: Record<string, unknown>;
    }>;
  }>;
}

export interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: {
    type?: string;
    default?: unknown;
    enum?: string[];
  };
}

export interface GroupedEndpoints {
  tag: string;
  paths: {
    path: string;
    method: string;
    safeId: string;
    operation: OpenApiOperation;
  }[];
}

function makeSafeId(method: string, path: string): string {
  const cleaned = path
    .replace(/[\{\}'\"]/g, "_")
    .replace(/\*\*/g, "wild-wild")
    .replace(/\*/g, "wild")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${method}-${cleaned}`;
}

const METHOD_ORDER = ["get", "post", "put", "patch", "delete", "options", "head"];

function extractTag(path: string, method: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 3 && segments[0] === "api") {
    return segments[1];
  }
  if (segments.length >= 2 && segments[0] === "api") {
    return "core";
  }
  return "other";
}

function methodSort(a: string, b: string): number {
  const ia = METHOD_ORDER.indexOf(a);
  const ib = METHOD_ORDER.indexOf(b);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
}

export function groupEndpoints(spec: OpenApiSpec): GroupedEndpoints[] {
  const groups: Record<string, GroupedEndpoints["paths"]> = {};

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const tag = extractTag(path, method);
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push({ path, method, safeId: makeSafeId(method, path), operation });
    }
  }

  return Object.entries(groups)
    .map(([tag, paths]) => ({
      tag,
      paths: paths.sort((a, b) => methodSort(a.method, b.method)),
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

export async function fetchSpec(): Promise<OpenApiSpec> {
  const res = await fetch("/api/openapi");
  return res.json();
}
