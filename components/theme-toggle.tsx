'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {Button} from './ui/button';
export function ThemeToggle(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{let enabled=document.documentElement.classList.contains('dark');try{const saved=localStorage.getItem('boothbook-theme');enabled=saved==='dark'||saved!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches}catch{}document.documentElement.classList.toggle('dark',enabled);document.documentElement.style.colorScheme=enabled?'dark':'light';setDark(enabled)},[]);
 function toggle(){const next=!dark;document.documentElement.classList.toggle('dark',next);document.documentElement.style.colorScheme=next?'dark':'light';setDark(next);try{localStorage.setItem('boothbook-theme',next?'dark':'light')}catch{}}
 return <Button variant="outline" onClick={toggle} aria-label={dark?'Switch to light mode':'Switch to dark mode'} aria-pressed={dark}>{dark?<Sun size={16}/>:<Moon size={16}/>}<span>{dark?'Light mode':'Dark mode'}</span></Button>;
}
