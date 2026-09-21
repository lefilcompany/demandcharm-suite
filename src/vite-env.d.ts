/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />


declare module "*.asset.json" {
  const asset: { url: string };
  export default asset;
}
