// Zod schemas for A2UI message *shape* validation (structure only).
// Catalog conformance (valid component names / props) lives in lib/catalog/validate.ts.

import { z } from 'zod';

export const bindingSchema = z.object({ path: z.string() }).strict();

export const componentNodeSchema = z
  .object({ id: z.string(), component: z.string() })
  .passthrough();

export const messageSchema = z.union([
  z.object({
    createSurface: z.object({
      surfaceId: z.string(),
      root: z.string(),
      catalogId: z.string().optional(),
    }),
  }),
  z.object({
    updateComponents: z.object({
      surfaceId: z.string(),
      components: z.array(componentNodeSchema),
    }),
  }),
  z.object({
    updateDataModel: z.object({
      surfaceId: z.string(),
      path: z.string(),
      value: z.any(),
    }),
  }),
]);

export const messagesSchema = z.array(messageSchema);
