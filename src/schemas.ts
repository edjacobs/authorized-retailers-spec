// Generated from schemas/*.json by scripts/embed-schemas.mjs. Do not edit by hand.

export const common = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.1/common.json",
  "title": "Authorized Retailers v0.1 shared definitions",
  "$defs": {
    "specVersion": {
      "const": "authorized-retailers/0.1"
    },
    "timestamp": {
      "description": "RFC 3339 timestamp in UTC with a Z suffix.",
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,9})?Z$"
    },
    "domain": {
      "description": "A bare hostname: no scheme, port, path or trailing dot. Compared case-insensitively.",
      "type": "string",
      "maxLength": 253,
      "pattern": "^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$"
    },
    "countryCode": {
      "description": "ISO 3166-1 alpha-2, uppercase.",
      "type": "string",
      "pattern": "^[A-Z]{2}$"
    },
    "httpsUrl": {
      "type": "string",
      "format": "uri",
      "pattern": "^https://",
      "maxLength": 2048
    },
    "id": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{1,64}$"
    },
    "nonEmptyString": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256
    },
    "brand": {
      "type": "object",
      "required": [
        "name",
        "domain"
      ],
      "additionalProperties": false,
      "properties": {
        "name": {
          "$ref": "#/$defs/nonEmptyString"
        },
        "domain": {
          "$ref": "#/$defs/domain"
        }
      }
    },
    "sellerId": {
      "type": "string",
      "pattern": "^\\S{1,128}$"
    },
    "marketplaceChannel": {
      "type": "object",
      "required": [
        "type",
        "marketplace",
        "seller_id"
      ],
      "additionalProperties": false,
      "properties": {
        "type": {
          "enum": [
            "amazon",
            "walmart",
            "ebay"
          ]
        },
        "marketplace": {
          "$ref": "#/$defs/countryCode"
        },
        "seller_id": {
          "$ref": "#/$defs/sellerId"
        }
      }
    },
    "webChannel": {
      "type": "object",
      "required": [
        "type",
        "domain"
      ],
      "additionalProperties": false,
      "properties": {
        "type": {
          "const": "web"
        },
        "domain": {
          "$ref": "#/$defs/domain"
        }
      }
    },
    "physicalChannel": {
      "type": "object",
      "required": [
        "type",
        "address",
        "country"
      ],
      "additionalProperties": false,
      "properties": {
        "type": {
          "const": "physical"
        },
        "address": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "country": {
          "$ref": "#/$defs/countryCode"
        }
      }
    },
    "verifiableChannel": {
      "description": "A channel an agent can see and match on (section 6). Excludes physical.",
      "oneOf": [
        {
          "$ref": "#/$defs/marketplaceChannel"
        },
        {
          "$ref": "#/$defs/webChannel"
        }
      ]
    },
    "channel": {
      "oneOf": [
        {
          "$ref": "#/$defs/marketplaceChannel"
        },
        {
          "$ref": "#/$defs/webChannel"
        },
        {
          "$ref": "#/$defs/physicalChannel"
        }
      ]
    },
    "party": {
      "type": "object",
      "required": [
        "name"
      ],
      "additionalProperties": false,
      "properties": {
        "name": {
          "$ref": "#/$defs/nonEmptyString"
        },
        "entity_id": {
          "$ref": "#/$defs/id"
        }
      }
    },
    "territories": {
      "description": "ISO 3166-1 alpha-2 codes, or exactly [\"*\"] for worldwide.",
      "type": "array",
      "minItems": 1,
      "uniqueItems": true,
      "anyOf": [
        {
          "const": [
            "*"
          ]
        },
        {
          "items": {
            "$ref": "#/$defs/countryCode"
          }
        }
      ]
    },
    "productLine": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64,
      "pattern": "^\\S(.*\\S)?$"
    },
    "productLines": {
      "description": "Named product lines, or exactly [\"all\"].",
      "type": "array",
      "minItems": 1,
      "uniqueItems": true,
      "anyOf": [
        {
          "const": [
            "all"
          ]
        },
        {
          "items": {
            "allOf": [
              {
                "$ref": "#/$defs/productLine"
              },
              {
                "not": {
                  "const": "all"
                }
              }
            ]
          }
        }
      ]
    },
    "scope": {
      "type": "object",
      "required": [
        "territories",
        "product_lines"
      ],
      "additionalProperties": false,
      "properties": {
        "territories": {
          "$ref": "#/$defs/territories"
        },
        "product_lines": {
          "$ref": "#/$defs/productLines"
        }
      }
    },
    "authorization": {
      "type": "object",
      "required": [
        "id",
        "retailer",
        "channels",
        "scope",
        "expires"
      ],
      "additionalProperties": false,
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "retailer": {
          "$ref": "#/$defs/party"
        },
        "channels": {
          "description": "Section 6: every authorization MUST name at least one channel identifier.",
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/channel"
          }
        },
        "scope": {
          "$ref": "#/$defs/scope"
        },
        "proposed_by": {
          "description": "The distributor that proposed this authorization, if any (section 3).",
          "oneOf": [
            {
              "type": "null"
            },
            {
              "$ref": "#/$defs/party"
            }
          ]
        },
        "expires": {
          "$ref": "#/$defs/timestamp"
        }
      }
    },
    "signature": {
      "type": "object",
      "required": [
        "kid",
        "jws"
      ],
      "additionalProperties": false,
      "properties": {
        "kid": {
          "type": "string",
          "pattern": "^[A-Za-z0-9._-]{1,64}$"
        },
        "jws": {
          "description": "Detached compact JWS: header..signature (empty payload segment).",
          "type": "string",
          "pattern": "^[A-Za-z0-9_-]+\\.\\.[A-Za-z0-9_-]+$"
        }
      }
    }
  }
};

export const fileFull = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.1/file-full.json",
  "title": "authorized-retailers.json, full form",
  "type": "object",
  "required": [
    "spec",
    "form",
    "brand",
    "issued",
    "expires",
    "authorizations"
  ],
  "additionalProperties": false,
  "properties": {
    "spec": {
      "$ref": "common.json#/$defs/specVersion"
    },
    "form": {
      "const": "full"
    },
    "brand": {
      "$ref": "common.json#/$defs/brand"
    },
    "issued": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "expires": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "authorizations": {
      "type": "array",
      "items": {
        "$ref": "common.json#/$defs/authorization"
      }
    },
    "signature": {
      "description": "Optional in the schema: an unsigned file is well-formed but does not count (section 5).",
      "$ref": "common.json#/$defs/signature"
    }
  }
};

export const filePointer = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.1/file-pointer.json",
  "title": "authorized-retailers.json, pointer form",
  "type": "object",
  "required": [
    "spec",
    "form",
    "brand",
    "list"
  ],
  "additionalProperties": false,
  "properties": {
    "spec": {
      "$ref": "common.json#/$defs/specVersion"
    },
    "form": {
      "const": "pointer"
    },
    "brand": {
      "$ref": "common.json#/$defs/brand"
    },
    "list": {
      "$ref": "common.json#/$defs/httpsUrl"
    }
  }
};

export const filePrivate = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.1/file-private.json",
  "title": "authorized-retailers.json, private form",
  "type": "object",
  "required": [
    "spec",
    "form",
    "brand",
    "verify"
  ],
  "additionalProperties": false,
  "properties": {
    "spec": {
      "$ref": "common.json#/$defs/specVersion"
    },
    "form": {
      "const": "private"
    },
    "brand": {
      "$ref": "common.json#/$defs/brand"
    },
    "verify": {
      "$ref": "common.json#/$defs/httpsUrl"
    }
  }
};

export const file = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.1/file.json",
  "title": "authorized-retailers.json, any form",
  "type": "object",
  "required": [
    "form"
  ],
  "properties": {
    "form": {
      "enum": [
        "full",
        "pointer",
        "private"
      ]
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "form": {
            "const": "full"
          }
        }
      },
      "then": {
        "$ref": "file-full.json"
      }
    },
    {
      "if": {
        "properties": {
          "form": {
            "const": "pointer"
          }
        }
      },
      "then": {
        "$ref": "file-pointer.json"
      }
    },
    {
      "if": {
        "properties": {
          "form": {
            "const": "private"
          }
        }
      },
      "then": {
        "$ref": "file-private.json"
      }
    }
  ]
};

export const verifyRequest = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.1/verify-request.json",
  "title": "POST /v0/verify request (section 9)",
  "description": "Canonical form. Registries normalize case and whitespace before validating (see normalizeVerifyRequest).",
  "type": "object",
  "required": [
    "brand_domain",
    "channel",
    "territory"
  ],
  "additionalProperties": false,
  "properties": {
    "brand_domain": {
      "$ref": "common.json#/$defs/domain"
    },
    "channel": {
      "$ref": "common.json#/$defs/verifiableChannel"
    },
    "territory": {
      "$ref": "common.json#/$defs/countryCode"
    },
    "product_line": {
      "description": "Defaults to \"all\" when omitted.",
      "$ref": "common.json#/$defs/productLine"
    }
  }
};

export const verifyResponse = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.1/verify-response.json",
  "title": "POST /v0/verify response (section 9)",
  "type": "object",
  "required": [
    "status",
    "checked",
    "valid_until",
    "observed",
    "signals",
    "signature"
  ],
  "additionalProperties": false,
  "properties": {
    "status": {
      "enum": [
        "authorized",
        "unlisted",
        "expired",
        "brand_unverified",
        "disputed"
      ]
    },
    "reason": {
      "enum": [
        "not_registered",
        "domain_unlinked",
        "verification_lapsed"
      ]
    },
    "authorization_id": {
      "$ref": "common.json#/$defs/id"
    },
    "expires": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "checked": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "valid_until": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "observed": {
      "description": "Section 7: when the registry last saw this seller selling on the channel, within 30 days; otherwise null",
      "oneOf": [
        {
          "type": "null"
        },
        {
          "type": "object",
          "required": [
            "last_seen"
          ],
          "additionalProperties": false,
          "properties": {
            "last_seen": {
              "$ref": "common.json#/$defs/timestamp"
            }
          }
        }
      ]
    },
    "signals": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "type",
          "observed"
        ],
        "additionalProperties": false,
        "properties": {
          "type": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]{0,63}$"
          },
          "observed": {
            "$ref": "common.json#/$defs/timestamp"
          },
          "detail": {
            "type": "string",
            "maxLength": 1024
          }
        }
      }
    },
    "signature": {
      "$ref": "common.json#/$defs/signature"
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "status": {
            "const": "brand_unverified"
          }
        }
      },
      "then": {
        "not": {
          "anyOf": [
            {
              "required": [
                "authorization_id"
              ]
            },
            {
              "required": [
                "expires"
              ]
            }
          ]
        }
      },
      "else": {
        "not": {
          "required": [
            "reason"
          ]
        }
      }
    },
    {
      "if": {
        "not": {
          "properties": {
            "status": {
              "const": "authorized"
            }
          }
        }
      },
      "then": {
        "properties": {
          "observed": {
            "const": null
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "enum": [
              "authorized",
              "expired",
              "disputed"
            ]
          }
        }
      },
      "then": {
        "required": [
          "authorization_id",
          "expires"
        ]
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "const": "unlisted"
          }
        }
      },
      "then": {
        "not": {
          "anyOf": [
            {
              "required": [
                "authorization_id"
              ]
            },
            {
              "required": [
                "expires"
              ]
            }
          ]
        }
      }
    }
  ]
};
