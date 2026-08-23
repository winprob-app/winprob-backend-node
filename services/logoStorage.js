const axios = require("axios");
const { supabase } = require("../index");
const { normalizeLogoName } = require("./logoCatalog");

const BUCKET_NAME = "team-logos";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Busca el logo de un equipo SOLO en la caché de Supabase.
 * No llama a iSports. Rápido y seguro de usar en cada request.
 */
async function getTeamLogoFromCache(teamName) {
  const normalizedName = normalizeLogoName(teamName);

  if (!normalizedName) {
    return "";
  }

  const { data, error } = await supabase
    .from("team_logos")
    .select("logo_url")
    .eq("normalized_name", normalizedName)
    .maybeSingle();

  if (error) {
    console.error("❌ ERROR LEYENDO CACHÉ DE LOGO:", error.message);
    return "";
  }

  return data?.logo_url || "";
}

/**
 * Descarga un logo desde una URL de origen (iSports), lo sube a
 * Supabase Storage y guarda el registro en team_logos.
 */
async function cacheTeamLogoFromUrl(teamId, teamName, sourceLogoUrl) {
  const normalizedName = normalizeLogoName(teamName);

  if (!normalizedName || !sourceLogoUrl) {
    return null;
  }

  let imageBuffer;
  let contentType = "image/png";

  try {
    const imageResponse = await axios.get(sourceLogoUrl, {
      responseType: "arraybuffer",
    });
    imageBuffer = Buffer.from(imageResponse.data);
    contentType = imageResponse.headers["content-type"] || contentType;

    if (!contentType.startsWith("image/")) {
      console.error(
        `❌ RESPUESTA NO ES UNA IMAGEN (${contentType}) PARA: ${teamName}`
      );
      return null;
    }
  } catch (error) {
    console.error(
      `❌ ERROR DESCARGANDO LOGO DE: ${teamName}`,
      error.message
    );
    return null;
  }

  const fileName = `${normalizedName.replace(/\s+/g, "-")}.png`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, imageBuffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error(
      `❌ ERROR SUBIENDO LOGO A SUPABASE STORAGE: ${teamName}`,
      uploadError.message
    );
    return null;
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  const publicLogoUrl = publicUrlData?.publicUrl;

  if (!publicLogoUrl) {
    return null;
  }

  const { error: insertError } = await supabase
    .from("team_logos")
    .upsert(
      {
        team_id: teamId,
        team_name: teamName,
        normalized_name: normalizedName,
        logo_url: publicLogoUrl,
        source: "isports",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "normalized_name" }
    );

  if (insertError) {
    console.error(
      `❌ ERROR GUARDANDO REGISTRO DE LOGO: ${teamName}`,
      insertError.message
    );
  }

  console.log(`✅ LOGO GUARDADO: ${teamName}`);
  return publicLogoUrl;
}

module.exports = {
  getTeamLogoFromCache,
  cacheTeamLogoFromUrl,
  sleep,
};