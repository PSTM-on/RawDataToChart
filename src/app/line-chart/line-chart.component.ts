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

  // metadata 정보 입력
  private metadata = {
    deviceId: 'DF:4A:35:79:15:C9',
    startTime: 1681891200000,
    endTime: 1681981200000
  }

  // 해당 data의 protocal 입력
  private dataInterval = 200;

  // 상세히 보려는 구간의 data length에 대한 index 입력
  private sectionToView = {
    start: null,
    end: null,
  };

  private dataSet: {
    patchIndex: number;
    ts: number;
    dpTs: number;
    index: number;
  }[] = [];

  constructor(
    private http: HttpClient
  ) { }

  async ngOnInit(): Promise<void> {
    const requestNum = Math.ceil((this.metadata.endTime - this.metadata.startTime) / (60 * 60 * 1000));

    // 1. 데이터 먼저 다운로드 : getDataAndSaveToFile
    // await this.getDataAndSaveToFile(requestNum);
    
    // 2. 다운로드 받은 파일을 assets 폴더에 옮긴 뒤 아래 내용 진행
    await this.makeChartData(requestNum);
    // await this.compensateData();

    // 3. 그리려는 차트 선택
    this.drawChart(['patchIndex', 'ts']);

  }

  getDataAndSaveToFile(requestNum: number) {
    return new Promise<void>(async (resolve) => {
      for (let i = 1; i <= requestNum; i++) {
        const startTime = this.metadata.startTime + 60 * 60 * 1000 * (i - 1);
        const endTime = this.metadata.startTime + 60 * 60 * 1000 * i;
        const result = await this.getRawDataFromServer(startTime, endTime);
        const rawData = await this.rawDataFiltering(result);
        await this.saveRawDataToFile(rawData, i);

        if (i === requestNum) {
          resolve();
        }
      }   
    });
  }

  getRawDataFromServer(startTime: number, endTime: number) {
    return new Promise<any>((resolve) => {
      const headers = new HttpHeaders({ Account: this.accountId, 'Cache-Control': 'no-cache' });
      this.http.get(
        `https://api.hicardi.net:3000/history/getHistory2?deviceId=${
          this.metadata.deviceId}&startTime=${startTime}&endTime=${endTime}`, { headers }
      ).subscribe(rawData => {
        resolve(rawData);
      });
    });
  }

  rawDataFiltering(result: any) {
    return new Promise(resolve => {
      result.data.forEach(d => {
        d.ts = d.AE.AB;
        d.dpTs = d.AE.AC;
        d.patchIndex = d.AF.AA;
        d.appIndex = d.AF.AB;
        
        delete d.AE;
        delete d.AF;
        delete d.AB;
        delete d._id;
      });
      resolve(result.data);
    });
  }

  saveRawDataToFile(rawData: any, i: number) {
    return new Promise<void>(resolve => {
      const stringData = JSON.stringify(rawData);
      const file = new window.Blob([stringData], { type: 'text/plain' });

      const downloadAncher = document.createElement("a");
      downloadAncher.style.display = "none";

      const fileURL = URL.createObjectURL(file);
      downloadAncher.href = fileURL;
      downloadAncher.download = `rawData-${i}`;
      downloadAncher.click();
      resolve();
    });
  }

  makeChartData(requestNum: number) {
    return new Promise<void>(async (resolve) => {
      for(let i = 1; i <= requestNum; i++) {
        const data = await this.getDataFromTextFile(`rawData-${i}`);
        this.dataSet.push(...data);

        if (i === requestNum) {
          resolve();
        }
      }

      const startIndex = this.sectionToView.start ? this.sectionToView.start : 0;
      const endIndex = this.sectionToView.end ? this.sectionToView.end : this.dataSet.length - 1;
      this.dataSet = this.dataSet.slice(startIndex, endIndex + 1);
    });
  }

  compensateData() {
    return new Promise<void>(async (resolve) => {
      let prevPatchIndex = this.dataSet[0].patchIndex;
      let prevIndex = this.dataSet[0].patchIndex;

      for(let i = 0; i <= this.dataSet.length - 1; i++) {
        const data = this.dataSet[i];
        
        if (data.patchIndex < prevPatchIndex) {
          if (prevPatchIndex < prevIndex) {
            data.index = prevIndex + data.patchIndex;
          } else {
            data.index = prevPatchIndex + data.patchIndex;
          }
        } else {
          data.index = prevIndex + data.patchIndex - prevPatchIndex;
        }

        prevPatchIndex = data.patchIndex;
        prevIndex = data.index;
      }

      resolve();
    });
  }

  getDataFromTextFile(fileName: string) {
    return new Promise<any>((resolve) => {
      this.http.get(`../../assets/${fileName}.txt`, { responseType: 'text' }) 
      .subscribe(d => { 
        resolve(JSON.parse(d));
      }); 
    });
  }

  drawChart(mode: string[]) {
    // set the dimensions and margins of the graph
    const margin = { top: 10, right: 80, bottom: 30, left: 60 };
    const svgSize = 800;
    const width = svgSize + 800 - margin.left - margin.right;
    const height = svgSize - margin.top - margin.bottom;
    let y1 = null;
    let y2 = null;
    let valueLine1 = null;
    let valueLine2 = null;

    const svg = d3.select('#chart')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Add Title
    const title = svg.append('g')
      .attr('class', 'title')
    
    title.append('text')
      .attr('x', 18)
      .attr('y', 20)
      .style('fill', 'blue')
      .text('patchIndex Line');

    title.append('text')
      .attr('x', 150)
      .attr('y', 20)
      .style('fill', 'red')
      .text('ts Line');

    // Set X axis
    const x = d3.scaleLinear()
      .domain([0, this.dataSet.length - 1])
      .range([ 0, width ]);

    // Add X axis grid
    svg.append('g')
      .attr('class', 'grid-x')
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(x).tickSize(-height))
      .call(g => g.selectAll('.tick line')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-dasharray', '2, 2'));

    if (mode.includes('patchIndex')) {
      // Set Y1 axis
      y1 = d3.scaleLinear()
        .domain(d3.extent(this.dataSet, d => d.patchIndex))
        .range([ height, 0 ]);

      // Add Y1 axis grid
      svg.append('g')
      .attr('class', 'grid-y1')
      .call(d3.axisLeft(y1).tickSize(-width))
      .call(g => g.selectAll('.tick line')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-dasharray', '2, 2'));

      // Define line chart1
      valueLine1 = d3.line()
        .defined(d => d && d.patchIndex !== null && d.patchIndex !== undefined)
        .x((d, i) => x(i))
        .y(d => y1(d.patchIndex));

      // Add the line1
      svg.append('path')
        .attr('fill', 'none')
        .attr('stroke', 'blue')
        .attr('stroke-width', 1.5)
        .attr('d', valueLine1(this.dataSet));
    }

    if (mode.includes('ts')) {
      // Set Y2 axis
      const oneHour = 60 * 60 * 1000;
      y2 = d3.scaleLinear()
        .domain([this.dataSet[0].ts, this.dataSet[this.dataSet.length - 1].ts])
        .range([ height, 0 ]);

      // Add Y2 axis grid
      svg.append('g')
      .attr('class', 'grid-y2')
      .call(d3.axisRight(y2).tickFormat(d => {
        const dateData = new Date(d);
        const month = dateData.getMonth().toString().padStart(2, '0');
        const date = dateData.getDate().toString().padStart(2, '0');
        const hour = dateData.getHours().toString().padStart(2, '0');
        const minute = dateData.getMinutes().toString().padStart(2, '0');
        const second = dateData.getSeconds().toString().padStart(2, '0');
        return `${month}/${date} ${hour}:${minute}:${second}`;
      }))
      .attr('transform', 'translate(' + width + ', 0)');

      // Define line chart2
      valueLine2 = d3.line()
        .defined(d => d && d.ts !== null && d.ts !== undefined)
        .x((d, i) => x(i))
        .y(d => y2(d.ts));

      // Add the line2
      svg.append('path')
        .attr('fill', 'none')
        .attr('stroke', 'red')
        .attr('stroke-width', 1.5)
        .attr('d', valueLine2(this.dataSet));
    }

    // Add tooltip
    const tooltip = svg.append('g')
    .attr('class', 'tooltip');

    // Add tooltip container
    tooltip.append('rect')
      .attr('class', 'tooltip-container')
      .attr('width', 50)
      .attr('height', 10)
      .attr('fill', 'rgba(255, 255, 255, 0.3)')
      .attr('x', -20)
      .attr('y', 0.2);

    // Add tooltip text
    tooltip.append('text')
      .attr('class', 'tooltip-text')
      .attr('x', 18)
      .attr('y', 40);

    tooltip.raise();

    // Add mouse event listener block
    svg.append('rect')
    .attr('class', `overlay`)
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'transparent')
    .on('mousemove', (event) => {
      const xy = [event.offsetX - margin.left, event.offsetY - margin.top];
      const xValue = Math.floor(x.invert(xy[0]));
      const y1Value = this.dataSet[xValue].patchIndex;
      const y2Value = this.dataSet[xValue].ts;

      const dateData = new Date(y2Value);
      const month = dateData.getMonth().toString().padStart(2, '0');
      const date = dateData.getDate().toString().padStart(2, '0');
      const hour = dateData.getHours().toString().padStart(2, '0');
      const minute = dateData.getMinutes().toString().padStart(2, '0');
      const second = dateData.getSeconds().toString().padStart(2, '0');
      const milisecond = dateData.getMilliseconds().toString().padStart(3, '0');
      svg.select('.tooltip-text').text(`dataIndex: ${xValue.toLocaleString()}, patchIndex: ${y1Value.toLocaleString()}, ts: ${month}/${date} ${hour}:${minute}:${second}:${milisecond}`);
    });
  }

  openBlob(data: any) {
    const blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    window.open(url);
  }
}
