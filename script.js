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

const dash_segment = (width, a, b = a) => {
  const ab = a + b;
  let n = Math.floor((width - a) / ab);
  // n (a + b) + a
  // n (a + b) - b
  // n (a + b) - b < width < n (a + b) + a
  // width - n (a + b) - b < n (a + b) + a - width
  n += width >= (n + 0.5) * ab;
  // n = (width - k*a) / (k*a + k*b);
  // n = (width/k - a) / (a + b);
  // n (a + b) = width/k - a;
  // n (a + b) + a = width/k;
  const k = width/( n * ab + a );
  if (a == b) {
    return `${a * k}`;
  } else {
    return `${a * k} ${b * k}`;
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

    const width = 900;
    const height = 300;
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

    for (const name of ['Glucose', 'Lantus']) {
      const values = allValues[name];

      const yScale = d3.scaleLinear(
        [ 0, d3.max(values, x => x[1]) * 1.05 ],
        [ height - margin.bottom, margin.top ]
      ).nice();

      const def = defs.find(x => x.name === name);
      if (def.normal !== undefined) {
        const [ x1, x2 ] = xScale.range();
        const [ y1, y2 ] = def.normal;
        $(plot.node(), 'path', {
          d: `M${x1} ${yScale(y1)} H${x2} M${x1} ${yScale(y2)} H${x2}`,
          'stroke': '#777', 'stroke-width': 2, 'stroke-linecap': 'butt',
          'stroke-dasharray': dash_segment(x2 - x1, 10, 8), 'fill': 'none'
        });
      }

      if (name === 'Glucose') { // TODO
        plot.append('g')
          .attr('transform', `translate(${margin.left},0)`)
          .call(d3.axisLeft(yScale));
      }

      plot.append('path')
        .datum(values)
        .attr('fill', 'none')
        .attr('stroke', def.color)
        .attr('stroke-width', 2)
        .attr('d', d3.line()
          .x(d => xScale(d[0]))
          .y(d => yScale(d[1]))
        );

      plot.append('g')
        .selectAll('circle')
        .data(values)
        .join('circle')
          .attr('cx', d => xScale(d[0]))
          .attr('cy', d => yScale(d[1]))
          .attr('r', 4)
          .style('fill', def.color);
    }

    // https://github.com/ivankp/web-plots/blob/master/main.js#L294

    $(document.body, 'div', plot.node());

    const timeFormat = d3.timeFormat('%a, %d %b %I:%M %p');

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
      $(tr, 'td', { text: timeFormat(time) }, ['tt']);
      for (const { name, fixed } of defs) {
        let value = values[name];
        if (fixed !== undefined && Number.isFinite(value))
          value = value.toFixed(fixed);
        $(tr, 'td', { text: value });
      }
    }
  });
});
