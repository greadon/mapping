export async function markerWords(point,{key,fetcher=fetch}={}){
  if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>90||Math.abs(point[1])>180)throw new Error('Invalid coordinates.');
  if(!key)return {configured:false};
  const url=new URL('https://api.what3words.com/v3/convert-to-3wa');url.searchParams.set('coordinates',point.join(','));url.searchParams.set('language','en');url.searchParams.set('key',key);
  const response=await fetcher(url,{signal:AbortSignal.timeout(8000),redirect:'error'}),body=await response.json();
  if(!response.ok||body.error||typeof body.words!=='string'||body.words.split('.').length!==3)throw new Error('what3words lookup unavailable.');
  return {configured:true,words:body.words};
}
