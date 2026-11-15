import {defineConfig,loadEnv} from 'vite'

export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'VITE_')
  const candidate=env.VITE_SITE_URL||(process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:'')
  let site=''
  if(candidate){const url=new URL(candidate);if(url.protocol!=='https:')throw new Error('VITE_SITE_URL must use HTTPS');site=url.origin}
  return {
    server:{host:'127.0.0.1',port:5181,strictPort:true,watch:{usePolling:true,interval:700}},
    plugins:[{
      name:'wish-share-metadata',
      transformIndexHtml(){
        return [
          {tag:'meta',attrs:{property:'og:image',content:`${site}/share-cover.png`},injectTo:'head'},
          {tag:'meta',attrs:{name:'twitter:image',content:`${site}/share-cover.png`},injectTo:'head'},
          ...(site?[{tag:'link',attrs:{rel:'canonical',href:`${site}/`},injectTo:'head'},{tag:'meta',attrs:{property:'og:url',content:`${site}/`},injectTo:'head'}]:[])
        ]
      }
    }]
  }
})
