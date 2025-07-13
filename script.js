const $ = (p, ...args) => {
  if (p.constructor === String) {
    p = document.getElementById(p);
  }
  for (let x of args) {
    if (x.constructor === String) {
      p = p.appendChild( (p instanceof SVGElement || x==='svg')
        ? document.createElementNS('http://www.w3.org/2000/svg', x)
        : document.createElement(x)
      );
    } else if (x.nodeType === Node.ELEMENT_NODE) {
      p.appendChild(x);
    } else if (x.constructor === Array) {
      p.classList.add(...x);
    } else if (x.constructor === Function) {
      x(p);
    } else if (x.constructor === Object) {
      for (const [key,val] of Object.entries(x)) {
        if (key==='style') {
          for (const [k,v] of Object.entries(val)) {
            if (v!==null) p.style[k] = v;
            else p.style.removeProperty(k);
          }
        } else if (key==='events') {
          for (const [k,v] of Object.entries(val)) {
            if (v!==null) p.addEventListener(k,v);
            else p.removeEventListener(k);
          }
        } else if (key==='text') {
          p.textContent = val;
        } else {
          if (val!==null) {
            if (p instanceof SVGElement)
              p.setAttributeNS(null,key,val);
            else
              p.setAttribute(key,val);
          } else {
            if (p instanceof SVGElement)
              p.removeAttributeNS(null,key);
            else
              p.removeAttribute(key);
          }
        }
      }
    }
  }
  return p;
};
const $$ = (...args) => p => $(p, ...args);

const $fetch = async (url, json = true) => {
  try {
    const resp = await fetch(url, { referrer: '' });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return await json ? resp.json() : resp.text();
  } catch (error) {
    console.error('Fetch error:', error);
  }
};

const dash_segment = (width, a, b = a) => {
  const ab = a + b;
  let n = Math.floor((width - a) / ab);
  n += width >= (n + 0.5) * ab;
  const k = width/( n * ab + a );
  if (a == b) {
    return `${a * k}`;
  } else {
    return `${a * k} ${b * k}`;
  }
};

const data_url =
'https://docs.google.com/spreadsheets/d/e/2PACX-1vSd9bRCnFgPozZ-okut_xHm1EVSmI9AJKqwEzLp0fMqI37jpqGqa7IbuuHdi2m4woLdutpKqu1aKJIo/pub?gid=0&single=true&output=tsv';

const width = 900;
const height = 300;
const margin = { top: 20, right: 20, bottom: 30, left: 40 };

const stylesDefs = {
    Glucose: {
      color: '#c50', scale: 'left', connect: true, normal: [ 80, 120 ]
    },
    Ketones: { fixed: 1 },
    Lantus : { fixed: 1, color: '#0809', range: [ 266, margin.top ] },
    Humulin: { fixed: 1, color: '#8089', range: [ 266+7, margin.top+7 ]  },
    Fluids : { },
    Weight : { fixed: 1 },
    B12    : { }
};

const domains = [
  [ [ 'Lantus', 'Humulin' ], null ]
];

document.addEventListener('DOMContentLoaded', () => {
  $fetch(data_url, false).then(tsv => {
    const [ names, units, ...rows ] = tsv.split(/\r?\n/).map(line => line.split('\t'));
    for (const row of rows) {
      row[0] = Date.parse(row[0]);
      for (let i = 0; i < row.length; ++i) {
        row[i] = row[i] ? parseFloat(row[i]) : null;
      }
    }

    const styles = names.map(name => stylesDefs[name]);

    for (const set of domains) {
      set[0] = set[0].map(x => names.indexOf(x));
    }

    const xScale = d3.scaleUtc(
      [ rows[0][0], rows[rows.length - 1][0] ],
      [ margin.left, width - margin.right ]
    );

    const plot = d3.create('svg')
      .attr('width', width)
      .attr('height', height);

    plot.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale));

    for (const col of [ 1, 3, 4 ]) {
      const style = styles[col];

      // domain = input, variable values
      // range = output, svg coordinates
      const yScale = d3.scaleLinear()
        .range(style.range ?? [ height - margin.bottom, margin.top ]);

      let domain = null;
      for (const set of domains) {
        if (set[0].includes(col)) {
          if (set[1] === null) {
            let max = null;
            for (const row of rows) {
              for (const i of set[0]) {
                const x = row[i];
                if (x !== null && (max === null || max < x))
                  max = x;
              }
            }
            console.log(max);
            set[1] = [ 0, max * 1.05 ];
          }
          domain = set[1];
          break;
        }
      }
      yScale.domain(domain ?? [ 0, d3.max(rows, row => row[col]) * 1.05 ]).nice();

      if (style.normal !== undefined) {
        const [ x1, x2 ] = xScale.range();
        const [ y1, y2 ] = style.normal;
        $(plot.node(), 'path', {
          d: `M${x1} ${yScale(y1)} H${x2} M${x1} ${yScale(y2)} H${x2}`,
          'stroke': style.color, 'stroke-width': 1.5, 'stroke-linecap': 'butt',
          'stroke-dasharray': dash_segment(x2 - x1, 10, 8), 'fill': 'none'
        });
      }

      if (style.scale === 'left') {
        plot.append('g')
          .attr('transform', `translate(${margin.left},0)`)
          .call(d3.axisLeft(yScale));
      }

      const g = plot.append('g');

      const xrows = rows.filter(d => d[col] !== null);

      if (style.connect) {
        g.append('path')
          .datum(xrows)
          .attr('fill', 'none')
          .attr('stroke', style.color)
          .attr('stroke-width', 2)
          .attr('d', d3.line()
            .x(d => xScale(d[0]))
            .y(d => yScale(d[col]))
          );
      }

      g.append('g')
        .style('fill', style.color)
        .selectAll('circle')
        .data(xrows)
        .join('circle')
          .attr('cx', d => xScale(d[0]))
          .attr('cy', d => yScale(d[col]))
          .attr('r', 4);
    }

    // https://github.com/ivankp/web-plots/blob/master/main.js#L294

    $(document.body, 'div', plot.node(), {
      // events: {
      //   click: e => {
      //     // $(e.target, { style: { 'object-fit': 'contain' } });
      //   }
      // }
    });

    const timeFormat = d3.timeFormat('%a, %d %b %I:%M %p');

    const table = $(document.body, 'div', 'table', ['data', 'tex']);
    let tr = $(table, 'tr');
    for (const text of names) {
      $(tr, 'td', { text });
    }
    tr = $(table, 'tr');
    for (const text of units) {
      $(tr, 'td', { text });
    }
    for (let i = rows.length; i--; ) {
      const [ time, ...cols ] = rows[i];
      tr = $(table, 'tr');
      $(tr, 'td', { text: timeFormat(time) }, ['tt']);
      cols.forEach((value, col) => {
        if (Number.isFinite(value)) {
          const fixed = styles[col+1]?.fixed;
          if (fixed !== undefined)
            value = value.toFixed(fixed);
        }
        $(tr, 'td', { text: value });
      });
    }
  });
});
