import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

interface OpenApiDoc {
  components: { schemas: Record<string, object> };
}

const doc = parse(
  readFileSync(join(__dirname, '..', '..', 'specs', 'openapi.yaml'), 'utf8'),
) as OpenApiDoc;

const ajv = new Ajv({ strict: false });
addFormats(ajv);

// Register every component schema under its $ref path so cross-references resolve.
for (const [name, schema] of Object.entries(doc.components.schemas)) {
  ajv.addSchema(schema, `#/components/schemas/${name}`);
}

/**
 * Assert `body` matches the named schema from openapi.yaml's components.
 * Throws with ajv's error details on mismatch.
 */
export function assertMatchesSchema(schemaName: string, body: unknown): void {
  const validate = ajv.getSchema(`#/components/schemas/${schemaName}`);
  if (!validate) {
    throw new Error(`Schema '${schemaName}' not found in openapi.yaml`);
  }
  if (!validate(body)) {
    throw new Error(
      `Response does not match schema '${schemaName}': ${ajv.errorsText(validate.errors)}\n` +
        JSON.stringify(body, null, 2),
    );
  }
}
