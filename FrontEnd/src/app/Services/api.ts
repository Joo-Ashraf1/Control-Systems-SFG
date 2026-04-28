import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ParsedGraph } from '../Models/parsed-graph';
import { Results } from '../Models/results';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class API {
  constructor(private http: HttpClient) {}

  calculate(graph: ParsedGraph): Observable<Results> {
    return this.http.post<Results>(`${environment.baseUrl}/calculate`, graph);
  }
}
