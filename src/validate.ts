import { Validator, type OutputUnit } from "@cfworker/json-schema";
import common from "../schemas/common.json";
import fileFull from "../schemas/file-full.json";
import filePointer from "../schemas/file-pointer.json";
import filePrivate from "../schemas/file-private.json";
import file from "../schemas/file.json";
import verifyRequest from "../schemas/verify-request.json";
import verifyResponse from "../schemas/verify-response.json";
import { MAX_ANSWER_VALIDITY_MS, MAX_EXPIRY_MS } from "./constants";
import { parseTimestamp } from "./timestamp";
import type {
  AuthorizedRetailersFile,
  Channel,
  Scope,
  FullFile,
  PointerFile,
  PrivateFile,
  VerifyRequest,
  VerifyResponse,
} from "./types";

export type ErrorCode =
  | "schema"
  | "invalid_timestamp"
  | "expires_not_after_issued"
  | "file_expiry_exceeds_max"
  | "authorization_expires_after_file"
  | "duplicate_authorization_id"
  | "valid_until_not_after_checked"
  | "valid_until_exceeds_max";

export interface ValidationError {
  code: ErrorCode;
  /** JSON Pointer into the instance, e.g. "/authorizations/0/expires". */
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { valid: true; value: T; errors: [] }
  | { valid: false; errors: ValidationError[] };

type Schema = Record<string, unknown>;
const ALL_SCHEMAS: Schema[] = [common, fileFull, filePointer, filePrivate, file, verifyRequest, verifyResponse];
const scopeSchema: Schema = { $id: "https://authorizedretailers.ai/schemas/0.1/scope.json", $ref: "common.json#/$defs/scope" };
const channelSchema: Schema = { $id: "https://authorizedretailers.ai/schemas/0.1/channel.json", $ref: "common.json#/$defs/channel" };

function makeValidator(root: Schema): Validator {
  const v = new Validator(root as never, "2020-12", false);
  for (const s of ALL_SCHEMAS) if (s !== root) v.addSchema(s as never);
  return v;
}

// Built lazily: compiling at module load would slow Worker cold starts for callers that never validate.
const validators = new Map<Schema, Validator>();
function schemaErrors(root: Schema, instance: unknown): ValidationError[] {
  let v = validators.get(root);
  if (!v) {
    v = makeValidator(root);
    validators.set(root, v);
  }
  const result = v.validate(instance);
  if (result.valid) return [];
  return dedupe(result.errors.map(toError));
}

function toError(unit: OutputUnit): ValidationError {
  const path = unit.instanceLocation.replace(/^#/, "");
  return { code: "schema", path, message: `${unit.error} (${unit.keywordLocation})` };
}

function dedupe(errors: ValidationError[]): ValidationError[] {
  const seen = new Set<string>();
  return errors.filter((e) => {
    const k = `${e.path}|${e.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function done<T>(errors: ValidationError[], value: unknown): ValidationResult<T> {
  return errors.length === 0 ? { valid: true, value: value as T, errors: [] } : { valid: false, errors };
}

function ts(errors: ValidationError[], path: string, value: string): number | null {
  const ms = parseTimestamp(value);
  if (ms === null) errors.push({ code: "invalid_timestamp", path, message: `not a valid UTC timestamp: ${value}` });
  return ms;
}

/** Rules the JSON Schema cannot express (sections 5 and 10). Assumes the file already passed the schema. */
function fullFileRules(f: FullFile): ValidationError[] {
  const errors: ValidationError[] = [];
  const issued = ts(errors, "/issued", f.issued);
  const expires = ts(errors, "/expires", f.expires);

  if (issued !== null && expires !== null) {
    if (expires <= issued) {
      errors.push({ code: "expires_not_after_issued", path: "/expires", message: "file expires must be after issued" });
    } else if (expires - issued > MAX_EXPIRY_MS) {
      errors.push({
        code: "file_expiry_exceeds_max",
        path: "/expires",
        message: "file expires more than 180 days after issued (section 10)",
      });
    }
  }

  const ids = new Set<string>();
  f.authorizations.forEach((a, i) => {
    const base = `/authorizations/${i}`;
    if (ids.has(a.id)) {
      errors.push({ code: "duplicate_authorization_id", path: `${base}/id`, message: `duplicate authorization id ${a.id}` });
    }
    ids.add(a.id);
    const aExpires = ts(errors, `${base}/expires`, a.expires);
    if (aExpires !== null && expires !== null && aExpires > expires) {
      errors.push({
        code: "authorization_expires_after_file",
        path: `${base}/expires`,
        message: "an authorization's expires MUST NOT be later than the file's expires (section 5)",
      });
    }
  });
  return errors;
}

function verifyResponseRules(r: VerifyResponse): ValidationError[] {
  const errors: ValidationError[] = [];
  const checked = ts(errors, "/checked", r.checked);
  const validUntil = ts(errors, "/valid_until", r.valid_until);
  if ("expires" in r) ts(errors, "/expires", r.expires);
  for (const [i, s] of r.signals.entries()) ts(errors, `/signals/${i}/observed`, s.observed);
  if (r.observed) ts(errors, "/observed/last_seen", r.observed.last_seen);
  if (checked !== null && validUntil !== null) {
    if (validUntil <= checked) {
      errors.push({ code: "valid_until_not_after_checked", path: "/valid_until", message: "valid_until must be after checked" });
    } else if (validUntil - checked > MAX_ANSWER_VALIDITY_MS) {
      errors.push({
        code: "valid_until_exceeds_max",
        path: "/valid_until",
        message: "valid_until MUST be no later than 24 hours after checked (section 9)",
      });
    }
  }
  return errors;
}

/** Validates an authorized-retailers.json file of any form. */
export function validateFile(input: unknown): ValidationResult<AuthorizedRetailersFile> {
  const errors = schemaErrors(file, input);
  if (errors.length === 0 && (input as AuthorizedRetailersFile).form === "full") {
    errors.push(...fullFileRules(input as FullFile));
  }
  return done(errors, input);
}

export function validateFullFile(input: unknown): ValidationResult<FullFile> {
  const errors = schemaErrors(fileFull, input);
  if (errors.length === 0) errors.push(...fullFileRules(input as FullFile));
  return done(errors, input);
}

export function validatePointerFile(input: unknown): ValidationResult<PointerFile> {
  return done(schemaErrors(filePointer, input), input);
}

export function validatePrivateFile(input: unknown): ValidationResult<PrivateFile> {
  return done(schemaErrors(filePrivate, input), input);
}

/** Validates a canonical verify request. Call normalizeVerifyRequest on raw agent input first. */
export function validateVerifyRequest(input: unknown): ValidationResult<VerifyRequest> {
  return done(schemaErrors(verifyRequest, input), input);
}

export function validateVerifyResponse(input: unknown): ValidationResult<VerifyResponse> {
  const errors = schemaErrors(verifyResponse, input);
  if (errors.length === 0) errors.push(...verifyResponseRules(input as VerifyResponse));
  return done(errors, input);
}

/** Validates one authorization scope (§3), e.g. before a registry stores it. */
export function validateScope(input: unknown): ValidationResult<Scope> {
  return done(schemaErrors(scopeSchema, input), input);
}

/** Validates one channel identifier (§6), e.g. before a registry stores it. */
export function validateChannel(input: unknown): ValidationResult<Channel> {
  return done(schemaErrors(channelSchema, input), input);
}
