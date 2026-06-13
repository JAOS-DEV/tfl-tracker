export const IBUS_OPERATOR_CODES = [
  "AT",
  "BE",
  "CV",
  "CX",
  "DC",
  "EB",
  "FT",
  "HY",
  "IF",
  "KE",
  "LC",
  "LD",
  "LG",
  "ML",
  "MN",
  "MT",
  "SL",
  "SV",
  "LU",
] as const;

export type IbusOperatorCode = (typeof IBUS_OPERATOR_CODES)[number];
