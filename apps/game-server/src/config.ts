export function simulationRate(value:string|number|undefined):10|15|20 {
  const rate=Number(value??20);
  if(rate!==10&&rate!==15&&rate!==20)throw Error('SIMULATION_HZ must be 10, 15, or 20');
  return rate;
}
