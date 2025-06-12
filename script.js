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

const fetch_json = async (url) => {
  try {
    const resp = await fetch( url, { referrer: '' });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return await resp.json();
  } catch (error) {
    console.error('Fetch error:', error);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  fetch_json('data.json').then(({ data, defs }) => {
    data = Object.entries(data).map(([ time, values ]) => {
      return [ Date.parse(time), values ];
    });
    data.sort((a, b) => a[0] - b[0]);

    const allValues = { };
    for (const [ time, named_values ] of data) {
      for (const [ name, value ] of Object.entries(named_values)) {
        ( allValues[name] ?? (allValues[name] = []) ).push([ time, value ]);
      }
    }

    const width = 1100;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const xScale = d3.scaleUtc(
      [ data[0][0], data[data.length - 1][0] ],
      [ margin.left, width - margin.right ]
    );

    const plot = d3.create('svg')
      .attr('width', width)
      .attr('height', height);

    plot.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale));

    const glucose = allValues['Glucose'];

    const yScale = d3.scaleLinear(
      [ 0, d3.max(glucose, x => x[1]) ],
      [ height - margin.bottom, margin.top ]
    ).nice();

    {
      const [ x1, x2 ] = xScale.range();
      const [ y1, y2 ] = defs.find(x => x.name === 'Glucose').normal;
      const dash = 1/(0.1 + 1/(x2-x1));
      $(plot.node(), 'path', {
        d: `M${x1} ${yScale(y1)} H${x2} M${x1} ${yScale(y2)} H${x2}`,
        'stroke': '#777', 'stroke-width': 2, 'stroke-linecap': 'butt',
        'stroke-dasharray': `${dash},${dash}`
      });
    }

    plot.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale));

    plot.append('path')
      .datum(glucose)
      .attr('fill', 'none')
      .attr('stroke', '#cc5500')
      .attr('stroke-width', 2)
      .attr('d', d3.line()
        .x(d => xScale(d[0]))
        .y(d => yScale(d[1]))
      );

    plot.append('g')
      .selectAll('circle')
      .data(glucose)
      .join('circle')
        .attr('cx', d => xScale(d[0]))
        .attr('cy', d => yScale(d[1]))
        .attr('r', 4)
        .style('fill', '#cc5500');

    const lantus = allValues['Lantus'];

    const yScale2 = d3.scaleLinear(
      [ 0, 5 ],
      [ height - margin.bottom, margin.top ]
    );

    plot.append('path')
      .datum(lantus)
      .attr('fill', 'none')
      .attr('stroke', '#080')
      .attr('stroke-width', 2)
      .attr('d', d3.line()
        .x(d => xScale(d[0]))
        .y(d => yScale2(d[1]))
      );

    plot.append('g')
      .selectAll('circle')
      .data(lantus)
      .join('circle')
        .attr('cx', d => xScale(d[0]))
        .attr('cy', d => yScale2(d[1]))
        .attr('r', 4)
        .style('fill', '#080');

    $(document.body, 'div', plot.node());

    const table = $(document.body, 'div', 'table', ['data', 'tex']);
    const tr1 = $(table, 'tr');
    const tr2 = $(table, 'tr');
    $(tr1, 'td', { text: 'Time' });
    $(tr2, 'td');
    for (const { name, units } of defs) {
      $(tr1, 'td', { text: name });
      $(tr2, 'td', { text: units });
    }
    for (let i = data.length; i--; ) {
      const [ time, values ] = data[i];
      const tr = $(table, 'tr');
      $(tr, 'td', { text: `${time}` });
      for (const { name, fixed } of defs) {
        let value = values[name];
        if (fixed !== undefined && Number.isFinite(value))
          value = value.toFixed(fixed);
        $(tr, 'td', { text: value });
      }
    }
  });
});
