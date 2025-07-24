import fetch from 'node-fetch';
import { GoogleAuth } from 'google-auth-library';

const decodeCredentials = () => {
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_B64;
  if (!b64) throw new Error('Falta GOOGLE_APPLICATION_CREDENTIALS_JSON_B64');
  const jsonStr = Buffer.from(b64, 'base64').toString('utf-8');
  return JSON.parse(jsonStr);
};

export const enviarMensaje = async (req, res) => {
  try {
    const credentials = decodeCredentials();

    const auth = new GoogleAuth({
      credentials,
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const projectId = credentials.project_id;

    const respuesta = await fetch(
      `https://dialogflow.googleapis.com/v2/projects/${projectId}/agent/sessions/123456789:detectIntent`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          queryInput: {
            text: {
              text: req.body.message,
              languageCode: 'es'
            }
          }
        })
      }
    );

    const data = await respuesta.json();
    res.json({
      fulfillmentText: data.queryResult?.fulfillmentText || 'No hay respuesta',
      raw: data
    });
  } catch (error) {
    console.error('Error en Dialogflow:', error);
    res.status(500).json({ error: 'Error al conectarse con Dialogflow' });
  }
};


