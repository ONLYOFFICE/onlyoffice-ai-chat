export const CapabilitiesUI = {
  None: 0x00,
  Chat: 0x01,
  Image: 0x02,
  Embeddings: 0x04,
  Audio: 0x08,
  Vision: 0x80,
  Tools: 0x100,
} as const;
