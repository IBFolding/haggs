import {Nav} from '../nav';
import {CoveragePanel} from '../board/[id]/cut/coverage-panel';
export default function Page(){return <div className="app"><Nav current="Editor"/><main className="canvas" style={{maxWidth:1000,margin:'auto',padding:'40px 24px'}}><h1>Director’s library</h1><p>12 editorial coverage plans and 165 camera, lens, lighting and style setups. These create editable storyboards, not generated footage.</p><CoveragePanel/></main></div>;}
