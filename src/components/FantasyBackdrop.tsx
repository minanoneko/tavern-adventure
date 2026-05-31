import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';

function getWeatherMood(weather: string) {
  const text = weather.toLowerCase();
  if (/暴风|雷|storm|thunder/.test(text)) return 'storm';
  if (/雪|snow/.test(text)) return 'snow';
  if (/雨|rain|drizzle/.test(text)) return 'rain';
  if (/雾|霧|fog|mist/.test(text)) return 'fog';
  if (/阴|陰|多云|多雲|cloud|overcast/.test(text)) return 'cloudy';
  if (/晴|clear|sun/.test(text)) return 'clear';
  return 'cloudy';
}

function getTimeMood(timeOfDay: string) {
  const text = timeOfDay.toLowerCase();
  if (/深夜|夜晚|夜|midnight|night/.test(text)) return 'night';
  if (/傍晚|黄昏|黃昏|evening|dusk/.test(text)) return 'dusk';
  if (/清晨|黎明|morning|dawn/.test(text)) return 'dawn';
  return 'day';
}

export default function FantasyBackdrop() {
  const weather = useGameStore(s => s.worldState.weather);
  const timeOfDay = useGameStore(s => s.worldState.timeOfDay);
  const locationName = useGameStore(s => s.worldState.currentLocationName || s.worldState.currentLocation);

  const className = useMemo(() => {
    return `fantasy-backdrop weather-${getWeatherMood(weather)} time-${getTimeMood(timeOfDay)}`;
  }, [weather, timeOfDay]);

  return (
    <div className={className} aria-hidden="true">
      <div className="fantasy-map-layer" />
      <div className="fantasy-rune-layer" />
      <div className="fantasy-weather-layer" />
      <div className="fantasy-vignette-layer" />
      <div className="fantasy-location-sigil">{locationName?.slice(0, 10)}</div>
    </div>
  );
}
