import {defineConfig,loadEnv} from 'vite'

export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'VITE_')
  const base=process.env.GITHUB_PAGES==='true'?'/make-a-wish/':'/'
  const candidate=env.VITE_SITE_URL||(process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:'')
  let site=''
  if(candidate){const url=new URL(candidate);if(url.protocol!=='https:')throw new Error('VITE_SITE_URL must use HTTPS');site=url.origin}
  return {
    base,
    server:{host:'127.0.0.1',port:5181,strictPort:true,watch:{usePolling:true,interval:700}},
    plugins:[{
      name:'wish-share-metadata',
      transformIndexHtml(){
        return [
          {tag:'meta',attrs:{property:'og:image',content:`${site}${base}share-cover.png`},injectTo:'head'},
          {tag:'meta',attrs:{name:'twitter:image',content:`${site}${base}share-cover.png`},injectTo:'head'},
          ...(site?[{tag:'link',attrs:{rel:'canonical',href:`${site}${base}`},injectTo:'head'},{tag:'meta',attrs:{property:'og:url',content:`${site}${base}`},injectTo:'head'}]:[])
        ]
      }
    }]
  }
})
