import { ParsedGraph } from "./parsed-graph";

export interface TxtParseResult {
    success: boolean;
    graph?: ParsedGraph;
    errors: string[];
}
