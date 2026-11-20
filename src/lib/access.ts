/** Which Pro features this browser may use, plus the ids that stay locked. */
export interface Access {
  x509: boolean;
  archive: boolean;
  history: boolean;
  pwa: boolean;
  nested: boolean;
  lockedIds: Set<string>;
}
