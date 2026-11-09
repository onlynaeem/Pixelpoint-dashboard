export function phase1Payload({seller,vat,timestamp,total,tax}){
 seller=String(seller||'').trim();vat=String(vat||'').trim();
 if(!seller)throw Error('Seller name is required.');
 if(!/^3\d{13}3$/.test(vat))throw Error('Enter a 15-digit seller VAT number starting and ending with 3.');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp||'')||!Number.isFinite(Date.parse(timestamp)))throw Error('An original invoice timestamp with timezone is required.');
 if(!Number.isFinite(Number(total))||!Number.isFinite(Number(tax))||Number(total)<0||Number(tax)<0||Number(tax)>Number(total))throw Error('Invalid receipt totals for this invoice QR.');
 if([total,tax].some(v=>Math.abs(Number(v)*100-Math.round(Number(v)*100))>1e-7))throw Error('SAR source amounts must have at most two decimal places; no silent rounding.');
 const values=[seller,vat,timestamp,Number(total).toFixed(2),Number(tax).toFixed(2)],bytes=[];
 values.forEach((value,i)=>{const b=new TextEncoder().encode(value);if(b.length>255)throw Error('A QR field exceeds 255 UTF-8 bytes.');bytes.push(i+1,b.length,...b);});
 const payload=btoa(String.fromCharCode(...bytes));if(payload.length>500)throw Error('QR payload exceeds 500 characters.');return payload;
}

