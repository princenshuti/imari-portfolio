function l(n,t){const c=n.map(d=>d.map(a=>`"${String(a??"").replace(/"/g,'""')}"`).join(",")).join(`
`),o=URL.createObjectURL(new Blob([c],{type:"text/csv"})),e=document.createElement("a");e.href=o,e.download=t,document.body.appendChild(e),e.click(),document.body.removeChild(e),URL.revokeObjectURL(o)}export{l as d};
