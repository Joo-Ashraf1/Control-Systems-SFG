import { ForwardPath } from "./forward-path";
import { Loop } from "./loop";
import { NonTouching } from "./non-touching";

export interface Results {
  forwardPaths:   ForwardPath[];
  loops:            Loop[];
  nonTouchingLoops: NonTouching[];
  delta:            string;          
  deltaK:           string[];        
  tfSymbolic:       string;          
  tfNumeric?:       string;          
}
