import { Component, OnInit } from '@angular/core';
import * as d3 from 'd3';
import { HttpClient, HttpHeaders } from '@angular/common/http'

@Component({
  selector: 'app-line-chart',
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.scss']
})
export class LineChartComponent implements OnInit {

  private accountId = '630707744334b0230cb812af';
  private metadata = {
    deviceId: 'DF:4A:35:79:15:C9',
    startTime: 1681893173080,
    endTime: 1681894799999
  }

  constructor(
    private http: HttpClient
  ) { }

  async ngOnInit(): Promise<void> {
    const rawData = await this.getRawDataFromServer();
    const data = await this.getDataFromTextFile();
    this.drawChart(data);

  }

  getRawDataFromServer() {
    return new Promise<any>((resolve) => {
      const headers = new HttpHeaders({ Account: this.accountId, 'Cache-Control': 'no-cache' });
      this.http.get(
        `https://api.hicardi.net:3000/history/getHistory2?deviceId=${
          this.metadata.deviceId}&startTime=${
          this.metadata.startTime}&endTime=${
          this.metadata.endTime}`,
        {
          headers,
        },
      ).subscribe(rawData => {
        resolve(rawData);
      });
    });
  }

  getDataFromTextFile() {
    return new Promise<object>((resolve) => {
      this.http.get('../../assets/data.txt', { responseType: 'text' }) 
      .subscribe(d => { 
        resolve(JSON.parse(d));
      }); 
    });
  }

  drawChart(data: any) {
    // set the dimensions and margins of the graph
    const margin = { top: 10, right: 30, bottom: 30, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 800 - margin.top - margin.bottom;
    
    const svg = d3.select('#chart')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Add X axis
    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.x))
      .range([ 0, width ]);

    // Add Y axis
    const y = d3.scaleLinear()
      .domain(d3.extent(data, d => d.y))
      .range([ height, 0 ]);
    
    // Add X axis grid
    svg.append('g')
    .attr('class', 'grid-x')
    .attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(x).tickSize(-height))
    .call(g => g.selectAll('.tick line')
    .attr('stroke-opacity', 0.5)
    .attr('stroke-dasharray', '2, 2'));

    // Add Y axis grid
    svg.append('g')
    .attr('class', 'grid-y')
    .call(d3.axisLeft(y).tickSize(-width))
    .call(g => g.selectAll('.tick line')
    .attr('stroke-opacity', 0.5)
    .attr('stroke-dasharray', '2, 2'));

    // Define line chart
    const valueLine = d3.line()
      .x(d => x(d.x))
      .y(d => y(d.y));

    // Add the line
    svg.append('path')
      .attr('fill', 'none')
      .attr('stroke', 'blue')
      .attr('stroke-width', 1.5)
      .attr('d', valueLine(data));
  }

  openBlob(data: any) {
    const blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    window.open(url);
  }

}
