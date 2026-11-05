import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'WasteOps — Cleaner streets. Better coordinated.',description:'Report an issue in your neighbourhood and coordinate the work that makes a difference.',icons:{icon:'/favicon.svg'},manifest:'/manifest.webmanifest'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en-GB"><body>{children}</body></html>}
