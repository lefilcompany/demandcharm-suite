import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

interface SEOHeadProps {
  title?: string;
  description?: string;
  path?: string;
  noindex?: boolean;
}

const BASE_URL = "https://pla.soma.lefil.com.br";
const DEFAULT_TITLE = "SoMA - Sistema Operacional de Marketing";
const DEFAULT_DESCRIPTION = "Plataforma completa de gestão de demandas, projetos e produtividade para equipes de marketing.";

export function SEOHead({ title, description, path = "/", noindex = false }: SEOHeadProps) {
  const fullTitle = title ? `${title} | SoMA` : DEFAULT_TITLE;
  const desc = description || DEFAULT_DESCRIPTION;
  const canonicalUrl = `${BASE_URL}${path}`;

  // Imperatively update document.title so it always reflects the latest mounted
  // SEOHead, even when multiple Helmet instances mount/unmount during route changes.
  useEffect(() => {
    document.title = fullTitle;
  }, [fullTitle]);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonicalUrl} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonicalUrl} />
    </Helmet>
  );
}
