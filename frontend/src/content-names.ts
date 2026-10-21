import naming from '../../shared/display-names.json'
const replacements=Object.entries(naming.replace).sort((a,b)=>b[0].length-a[0].length)
export function fictionalText(value:string){for(const [from,to] of replacements)value=value.split(from).join(to);return value}
export function venueName(id:string,fallback='A place in the city'){return (naming.venues as Record<string,string>)[id]??fictionalText(fallback)}
