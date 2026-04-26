export interface SubPayLoad {
 transferFunction: string;       // symbolic T(s) from analysis
  gainValues: Record<string, string>; // { G1: '10', H1: '1/(s+2)' }
  sValue?: string;                // optional evaluation point e.g. '2j'
}
