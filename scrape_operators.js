const data = new Set([...document.querySelectorAll("body > dl > dt > a > tt > span"), ...document.querySelectorAll("body > div > dl > dt > a > tt")].map(el => el.innerText).filter(s => s.toLowerCase() === s))
console.log([...data].join('\n'))