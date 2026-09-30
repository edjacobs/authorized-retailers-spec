// Generated from schemas/*.json by scripts/embed-schemas.mjs. Do not edit by hand.

export const common = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.3/common.json",
  "title": "Authorized Retailers v0.3 shared definitions",
  "$defs": {
    "specVersion": {
      "const": "authorized-retailers/0.3"
    },
    "timestamp": {
      "description": "RFC 3339 timestamp in UTC with a Z suffix.",
      "type": "string",
      "format": "date-time",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,9})?Z$"
    },
    "date": {
      "description": "ISO 8601 calendar date.",
      "type": "string",
      "format": "date",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
    },
    "domain": {
      "description": "A bare hostname, lowercase: no scheme, port, path, trailing dot or leading www. (section 6).",
      "type": "string",
      "maxLength": 253,
      "pattern": "^(?!www\\.)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$"
    },
    "countryCode": {
      "description": "ISO 3166-1 alpha-2, uppercase. The United Kingdom is GB.",
      "enum": [
        "AD",
        "AE",
        "AF",
        "AG",
        "AI",
        "AL",
        "AM",
        "AO",
        "AQ",
        "AR",
        "AS",
        "AT",
        "AU",
        "AW",
        "AX",
        "AZ",
        "BA",
        "BB",
        "BD",
        "BE",
        "BF",
        "BG",
        "BH",
        "BI",
        "BJ",
        "BL",
        "BM",
        "BN",
        "BO",
        "BQ",
        "BR",
        "BS",
        "BT",
        "BV",
        "BW",
        "BY",
        "BZ",
        "CA",
        "CC",
        "CD",
        "CF",
        "CG",
        "CH",
        "CI",
        "CK",
        "CL",
        "CM",
        "CN",
        "CO",
        "CR",
        "CU",
        "CV",
        "CW",
        "CX",
        "CY",
        "CZ",
        "DE",
        "DJ",
        "DK",
        "DM",
        "DO",
        "DZ",
        "EC",
        "EE",
        "EG",
        "EH",
        "ER",
        "ES",
        "ET",
        "FI",
        "FJ",
        "FK",
        "FM",
        "FO",
        "FR",
        "GA",
        "GB",
        "GD",
        "GE",
        "GF",
        "GG",
        "GH",
        "GI",
        "GL",
        "GM",
        "GN",
        "GP",
        "GQ",
        "GR",
        "GS",
        "GT",
        "GU",
        "GW",
        "GY",
        "HK",
        "HM",
        "HN",
        "HR",
        "HT",
        "HU",
        "ID",
        "IE",
        "IL",
        "IM",
        "IN",
        "IO",
        "IQ",
        "IR",
        "IS",
        "IT",
        "JE",
        "JM",
        "JO",
        "JP",
        "KE",
        "KG",
        "KH",
        "KI",
        "KM",
        "KN",
        "KP",
        "KR",
        "KW",
        "KY",
        "KZ",
        "LA",
        "LB",
        "LC",
        "LI",
        "LK",
        "LR",
        "LS",
        "LT",
        "LU",
        "LV",
        "LY",
        "MA",
        "MC",
        "MD",
        "ME",
        "MF",
        "MG",
        "MH",
        "MK",
        "ML",
        "MM",
        "MN",
        "MO",
        "MP",
        "MQ",
        "MR",
        "MS",
        "MT",
        "MU",
        "MV",
        "MW",
        "MX",
        "MY",
        "MZ",
        "NA",
        "NC",
        "NE",
        "NF",
        "NG",
        "NI",
        "NL",
        "NO",
        "NP",
        "NR",
        "NU",
        "NZ",
        "OM",
        "PA",
        "PE",
        "PF",
        "PG",
        "PH",
        "PK",
        "PL",
        "PM",
        "PN",
        "PR",
        "PS",
        "PT",
        "PW",
        "PY",
        "QA",
        "RE",
        "RO",
        "RS",
        "RU",
        "RW",
        "SA",
        "SB",
        "SC",
        "SD",
        "SE",
        "SG",
        "SH",
        "SI",
        "SJ",
        "SK",
        "SL",
        "SM",
        "SN",
        "SO",
        "SR",
        "SS",
        "ST",
        "SV",
        "SX",
        "SY",
        "SZ",
        "TC",
        "TD",
        "TF",
        "TG",
        "TH",
        "TJ",
        "TK",
        "TL",
        "TM",
        "TN",
        "TO",
        "TR",
        "TT",
        "TV",
        "TW",
        "TZ",
        "UA",
        "UG",
        "UM",
        "US",
        "UY",
        "UZ",
        "VA",
        "VC",
        "VE",
        "VG",
        "VI",
        "VN",
        "VU",
        "WF",
        "WS",
        "YE",
        "YT",
        "ZA",
        "ZM",
        "ZW"
      ]
    },
    "httpsUrl": {
      "type": "string",
      "format": "uri",
      "pattern": "^https://",
      "maxLength": 2048
    },
    "registryUrl": {
      "description": "Section 5.1: a list URL MUST be on authorizedretailers.ai.",
      "type": "string",
      "format": "uri",
      "pattern": "^https://authorizedretailers\\.ai/",
      "maxLength": 2048
    },
    "id": {
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{1,64}$"
    },
    "revocationId": {
      "description": "Section 10.3: a random value, rv_ followed by at least 16 base64url characters.",
      "type": "string",
      "pattern": "^rv_[A-Za-z0-9_-]{16,64}$"
    },
    "nonEmptyString": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256
    },
    "sellerId": {
      "type": "string",
      "pattern": "^\\S{1,128}$"
    },
    "amazonChannel": {
      "type": "object",
      "required": [
        "type",
        "domain",
        "seller_id"
      ],
      "additionalProperties": false,
      "properties": {
        "type": {
          "const": "amazon"
        },
        "domain": {
          "enum": [
            "amazon.com",
            "amazon.ca",
            "amazon.co.uk",
            "amazon.de",
            "amazon.fr",
            "amazon.it",
            "amazon.es",
            "amazon.com.au"
          ]
        },
        "seller_id": {
          "$ref": "#/$defs/sellerId"
        }
      }
    },
    "walmartChannel": {
      "type": "object",
      "required": [
        "type",
        "domain",
        "seller_id"
      ],
      "additionalProperties": false,
      "properties": {
        "type": {
          "const": "walmart"
        },
        "domain": {
          "enum": [
            "walmart.com",
            "walmart.ca"
          ]
        },
        "seller_id": {
          "$ref": "#/$defs/sellerId"
        }
      }
    },
    "ebayChannel": {
      "type": "object",
      "required": [
        "type",
        "domain",
        "seller_id"
      ],
      "additionalProperties": false,
      "properties": {
        "type": {
          "const": "ebay"
        },
        "domain": {
          "enum": [
            "ebay.com",
            "ebay.co.uk",
            "ebay.ca",
            "ebay.de",
            "ebay.com.au"
          ]
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
          "allOf": [
            {
              "$ref": "#/$defs/domain"
            },
            {
              "not": {
                "enum": [
                  "amazon.com",
                  "amazon.ca",
                  "amazon.co.uk",
                  "amazon.de",
                  "amazon.fr",
                  "amazon.it",
                  "amazon.es",
                  "amazon.com.au",
                  "walmart.com",
                  "walmart.ca",
                  "ebay.com",
                  "ebay.co.uk",
                  "ebay.ca",
                  "ebay.de",
                  "ebay.com.au"
                ]
              }
            }
          ]
        }
      }
    },
    "channel": {
      "description": "Section 6. Every channel is identified by a domain.",
      "oneOf": [
        {
          "$ref": "#/$defs/amazonChannel"
        },
        {
          "$ref": "#/$defs/walmartChannel"
        },
        {
          "$ref": "#/$defs/ebayChannel"
        },
        {
          "$ref": "#/$defs/webChannel"
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
    "namedProductLines": {
      "type": "array",
      "uniqueItems": true,
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
    },
    "productIds": {
      "type": "array",
      "uniqueItems": true,
      "items": {
        "$ref": "#/$defs/id"
      }
    },
    "gtin": {
      "description": "8, 12, 13 or 14 digits with a valid GS1 check digit (checked by the validator).",
      "type": "string",
      "pattern": "^([0-9]{8}|[0-9]{12,14})$"
    },
    "asin": {
      "description": "10 uppercase letters or digits.",
      "type": "string",
      "pattern": "^[A-Z0-9]{10}$"
    },
    "product": {
      "description": "Section 3.1. At least one of gtin or asins.",
      "type": "object",
      "required": [
        "id",
        "name"
      ],
      "additionalProperties": false,
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "name": {
          "$ref": "#/$defs/nonEmptyString"
        },
        "product_line": {
          "$ref": "#/$defs/productLine"
        },
        "attributes": {
          "type": "object",
          "maxProperties": 32,
          "propertyNames": {
            "minLength": 1,
            "maxLength": 64
          },
          "additionalProperties": {
            "type": "string",
            "maxLength": 256
          }
        },
        "gtin": {
          "$ref": "#/$defs/gtin"
        },
        "asins": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "$ref": "#/$defs/asin"
          }
        }
      },
      "anyOf": [
        {
          "required": [
            "gtin"
          ]
        },
        {
          "required": [
            "asins"
          ]
        }
      ]
    },
    "scope": {
      "description": "Section 3. product_lines, products or both; territories optional (section 6.2).",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "territories": {
          "$ref": "#/$defs/territories"
        },
        "product_lines": {
          "$ref": "#/$defs/productLines"
        },
        "products": {
          "allOf": [
            {
              "$ref": "#/$defs/productIds"
            },
            {
              "minItems": 1
            }
          ]
        },
        "exclude_product_lines": {
          "$ref": "#/$defs/namedProductLines"
        },
        "exclude_products": {
          "$ref": "#/$defs/productIds"
        }
      },
      "anyOf": [
        {
          "required": [
            "product_lines"
          ]
        },
        {
          "required": [
            "products"
          ]
        }
      ]
    },
    "exclusions": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "product_lines": {
          "$ref": "#/$defs/namedProductLines"
        },
        "products": {
          "$ref": "#/$defs/productIds"
        }
      }
    },
    "authorization": {
      "type": "object",
      "required": [
        "id",
        "revocation_id",
        "retailer",
        "channels",
        "scope"
      ],
      "additionalProperties": false,
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "revocation_id": {
          "$ref": "#/$defs/revocationId"
        },
        "retailer": {
          "$ref": "#/$defs/party"
        },
        "channels": {
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
          "description": "Optional end date set by the brand (section 10).",
          "$ref": "#/$defs/timestamp"
        }
      }
    },
    "brand": {
      "description": "Pointer form: one domain.",
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
    "listBrand": {
      "description": "Every domain the list applies to (section 5.2).",
      "type": "object",
      "required": [
        "name",
        "domains"
      ],
      "additionalProperties": false,
      "properties": {
        "name": {
          "$ref": "#/$defs/nonEmptyString"
        },
        "domains": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "$ref": "#/$defs/domain"
          }
        },
        "aliases": {
          "description": "Section 4.2: other names the brand is known by, for display and search. Never used to resolve a brand.",
          "type": "array",
          "maxItems": 20,
          "uniqueItems": true,
          "items": {
            "$ref": "#/$defs/nonEmptyString"
          }
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
    },
    "productRef": {
      "description": "Section 9: a product by GTIN, ASIN or both.",
      "type": "object",
      "minProperties": 1,
      "additionalProperties": false,
      "properties": {
        "gtin": {
          "$ref": "#/$defs/gtin"
        },
        "asin": {
          "$ref": "#/$defs/asin"
        }
      }
    },
    "answerBrand": {
      "description": "Section 9.5: the brand an answer is about. name is absent for a domain that is not registered.",
      "type": "object",
      "required": [
        "domain"
      ],
      "additionalProperties": false,
      "properties": {
        "domain": {
          "$ref": "#/$defs/domain"
        },
        "name": {
          "$ref": "#/$defs/nonEmptyString"
        }
      }
    },
    "resolvedBy": {
      "description": "Section 9.5: how the registry found the brand.",
      "enum": [
        "brand_domain",
        "gtin",
        "asin"
      ]
    },
    "candidates": {
      "description": "Section 9.5: the registered brands whose catalogs hold the product.",
      "type": "array",
      "minItems": 1,
      "uniqueItems": true,
      "items": {
        "$ref": "#/$defs/answerBrand"
      }
    },
    "pointerSpecVersion": {
      "description": "Section 5.1: the pointer format is unchanged since v0.2, so a pointer may name either version.",
      "enum": [
        "authorized-retailers/0.2",
        "authorized-retailers/0.3"
      ]
    }
  }
};

export const list = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.3/list.json",
  "title": "Signed list (section 5.2)",
  "type": "object",
  "required": [
    "spec",
    "brand",
    "public",
    "issued",
    "valid_until",
    "stale_until",
    "signature"
  ],
  "additionalProperties": false,
  "properties": {
    "spec": {
      "$ref": "common.json#/$defs/specVersion"
    },
    "brand": {
      "$ref": "common.json#/$defs/listBrand"
    },
    "public": {
      "type": "boolean"
    },
    "issued": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "valid_until": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "stale_until": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "catalog": {
      "type": "array",
      "items": {
        "$ref": "common.json#/$defs/product"
      }
    },
    "exclusions": {
      "$ref": "common.json#/$defs/exclusions"
    },
    "authorizations": {
      "type": "array",
      "items": {
        "$ref": "common.json#/$defs/authorization"
      }
    },
    "signature": {
      "$ref": "common.json#/$defs/signature"
    }
  },
  "if": {
    "properties": {
      "public": {
        "const": true
      }
    }
  },
  "then": {
    "required": [
      "authorizations"
    ]
  },
  "else": {
    "not": {
      "anyOf": [
        {
          "required": [
            "authorizations"
          ]
        },
        {
          "required": [
            "catalog"
          ]
        },
        {
          "required": [
            "exclusions"
          ]
        }
      ]
    }
  }
};

export const pointer = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.3/pointer.json",
  "title": "authorized-retailers.json pointer (section 5.1)",
  "type": "object",
  "required": [
    "spec",
    "form",
    "brand",
    "verify_token",
    "list"
  ],
  "additionalProperties": false,
  "properties": {
    "spec": {
      "$ref": "common.json#/$defs/pointerSpecVersion"
    },
    "form": {
      "const": "pointer"
    },
    "brand": {
      "$ref": "common.json#/$defs/brand"
    },
    "verify_token": {
      "description": "The domain's public verification token (section 4).",
      "type": "string",
      "pattern": "^[A-Za-z0-9_-]{16,128}$"
    },
    "list": {
      "$ref": "common.json#/$defs/registryUrl"
    }
  }
};

export const resolveRequest = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.3/resolve-request.json",
  "title": "POST /v0/resolve request (section 9.5)",
  "description": "Canonical form. Call normalizeResolveRequest on raw input first.",
  "type": "object",
  "required": [
    "product"
  ],
  "additionalProperties": false,
  "properties": {
    "product": {
      "$ref": "common.json#/$defs/productRef"
    },
    "domain": {
      "description": "The Amazon marketplace domain the ASIN was seen on.",
      "$ref": "common.json#/$defs/domain"
    }
  }
};

export const resolveResponse = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.3/resolve-response.json",
  "title": "POST /v0/resolve response (section 9.5)",
  "type": "object",
  "required": [
    "status",
    "checked",
    "valid_until",
    "stale_until",
    "signature"
  ],
  "additionalProperties": false,
  "properties": {
    "status": {
      "enum": [
        "resolved",
        "product_not_found",
        "brand_ambiguous"
      ]
    },
    "brand": {
      "$ref": "common.json#/$defs/answerBrand"
    },
    "resolved_by": {
      "enum": [
        "gtin",
        "asin"
      ]
    },
    "candidates": {
      "$ref": "common.json#/$defs/candidates"
    },
    "checked": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "valid_until": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "stale_until": {
      "$ref": "common.json#/$defs/timestamp"
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
            "const": "resolved"
          }
        }
      },
      "then": {
        "required": [
          "brand",
          "resolved_by"
        ],
        "not": {
          "required": [
            "candidates"
          ]
        }
      },
      "else": {
        "not": {
          "anyOf": [
            {
              "required": [
                "brand"
              ]
            },
            {
              "required": [
                "resolved_by"
              ]
            }
          ]
        }
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "const": "brand_ambiguous"
          }
        }
      },
      "then": {
        "required": [
          "candidates"
        ],
        "properties": {
          "candidates": {
            "minItems": 2
          }
        }
      },
      "else": {
        "not": {
          "required": [
            "candidates"
          ]
        }
      }
    }
  ]
};

export const revocationFeed = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.3/revocation-feed.json",
  "title": "Revocation feed (section 10.3)",
  "type": "object",
  "required": [
    "spec",
    "feed",
    "issued",
    "valid_until",
    "stale_until",
    "entries",
    "signature"
  ],
  "additionalProperties": false,
  "properties": {
    "spec": {
      "$ref": "common.json#/$defs/specVersion"
    },
    "feed": {
      "const": "revocations"
    },
    "issued": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "valid_until": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "stale_until": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "revocation_id",
          "revoked"
        ],
        "additionalProperties": false,
        "properties": {
          "revocation_id": {
            "$ref": "common.json#/$defs/revocationId"
          },
          "revoked": {
            "$ref": "common.json#/$defs/timestamp"
          }
        }
      }
    },
    "signature": {
      "$ref": "common.json#/$defs/signature"
    }
  }
};

export const verifyRequest = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.3/verify-request.json",
  "title": "POST /v0/verify request (section 9)",
  "description": "Canonical form. Call normalizeVerifyRequest on raw input first. At least one of brand_domain or product is required.",
  "type": "object",
  "required": [
    "channel"
  ],
  "additionalProperties": false,
  "properties": {
    "brand_domain": {
      "$ref": "common.json#/$defs/domain"
    },
    "channel": {
      "$ref": "common.json#/$defs/channel"
    },
    "territory": {
      "$ref": "common.json#/$defs/countryCode"
    },
    "product_line": {
      "$ref": "common.json#/$defs/productLine"
    },
    "product": {
      "$ref": "common.json#/$defs/productRef"
    },
    "as_of": {
      "anyOf": [
        {
          "$ref": "common.json#/$defs/date"
        },
        {
          "$ref": "common.json#/$defs/timestamp"
        }
      ]
    }
  },
  "anyOf": [
    {
      "required": [
        "brand_domain"
      ]
    },
    {
      "required": [
        "product"
      ]
    }
  ]
};

export const verifyResponse = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://authorizedretailers.ai/schemas/0.3/verify-response.json",
  "title": "POST /v0/verify response (section 9)",
  "type": "object",
  "required": [
    "status",
    "checked",
    "valid_until",
    "stale_until",
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
        "brand_not_registered",
        "disputed",
        "product_not_found",
        "brand_ambiguous",
        "brand_mismatch"
      ]
    },
    "reason": {
      "enum": [
        "not_registered",
        "domain_unlinked",
        "verification_lapsed",
        "territory_mismatch",
        "product_excluded",
        "product_not_in_scope",
        "product_not_in_catalog"
      ]
    },
    "authorization_id": {
      "$ref": "common.json#/$defs/id"
    },
    "revocation_id": {
      "$ref": "common.json#/$defs/revocationId"
    },
    "expires": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "checked": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "as_of": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "valid_until": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "stale_until": {
      "$ref": "common.json#/$defs/timestamp"
    },
    "product": {
      "type": "object",
      "required": [
        "in_catalog"
      ],
      "additionalProperties": false,
      "properties": {
        "in_catalog": {
          "type": "boolean"
        },
        "id": {
          "$ref": "common.json#/$defs/id"
        },
        "product_line": {
          "$ref": "common.json#/$defs/productLine"
        }
      },
      "if": {
        "properties": {
          "in_catalog": {
            "const": false
          }
        }
      },
      "then": {
        "not": {
          "anyOf": [
            {
              "required": [
                "id"
              ]
            },
            {
              "required": [
                "product_line"
              ]
            }
          ]
        }
      }
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
    },
    "brand": {
      "$ref": "common.json#/$defs/answerBrand"
    },
    "resolved_by": {
      "$ref": "common.json#/$defs/resolvedBy"
    },
    "candidates": {
      "$ref": "common.json#/$defs/candidates"
    }
  },
  "allOf": [
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
          "authorization_id"
        ]
      },
      "else": {
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
    },
    {
      "if": {
        "properties": {
          "status": {
            "const": "expired"
          }
        }
      },
      "then": {
        "required": [
          "expires"
        ]
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "const": "authorized"
          }
        }
      },
      "then": {
        "required": [
          "revocation_id"
        ]
      },
      "else": {
        "properties": {
          "observed": {
            "const": null
          }
        },
        "not": {
          "required": [
            "revocation_id"
          ]
        }
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "const": "brand_not_registered"
          }
        }
      },
      "then": {
        "properties": {
          "reason": {
            "enum": [
              "not_registered",
              "domain_unlinked",
              "verification_lapsed"
            ]
          }
        }
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
        "properties": {
          "reason": {
            "enum": [
              "territory_mismatch",
              "product_excluded",
              "product_not_in_scope",
              "product_not_in_catalog"
            ]
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
        "not": {
          "required": [
            "reason"
          ]
        }
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "enum": [
              "product_not_found",
              "brand_ambiguous"
            ]
          }
        }
      },
      "then": {
        "not": {
          "anyOf": [
            {
              "required": [
                "brand"
              ]
            },
            {
              "required": [
                "resolved_by"
              ]
            },
            {
              "required": [
                "reason"
              ]
            }
          ]
        }
      },
      "else": {
        "required": [
          "brand",
          "resolved_by"
        ]
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "enum": [
              "brand_ambiguous",
              "brand_mismatch"
            ]
          }
        }
      },
      "then": {
        "required": [
          "candidates"
        ]
      },
      "else": {
        "not": {
          "required": [
            "candidates"
          ]
        }
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "const": "brand_ambiguous"
          }
        }
      },
      "then": {
        "properties": {
          "candidates": {
            "minItems": 2
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "enum": [
              "brand_mismatch",
              "brand_not_registered"
            ]
          }
        }
      },
      "then": {
        "properties": {
          "resolved_by": {
            "const": "brand_domain"
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "const": "brand_mismatch"
          }
        }
      },
      "then": {
        "not": {
          "required": [
            "reason"
          ]
        }
      }
    }
  ]
};
