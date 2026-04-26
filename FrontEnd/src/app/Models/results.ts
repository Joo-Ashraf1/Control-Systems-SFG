import { ForwardPath } from "./forward-path";
import { Loop } from "./loop";
import { NonTouching } from "./non-touching";

export interface Results {
  forwardPaths:   ForwardPath[];
  loops:            Loop[];
  nonTouchingLoops: NonTouching[];
  delta:            string;          // symbolic Δ
  deltaK:           string[];        // symbolic Δ_k per forward path
  tfSymbolic:       string;          // e.g.  "G1*G2*G3 / (1 - G2*H1)"
  tfNumeric?:       string;          // after substitution
}
