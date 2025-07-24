import fetch from 'node-fetch';
import { GoogleAuth } from 'google-auth-library';

export const enviarMensaje = async (req, res) => {
  try {
    const auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const projectId = 'prueba-opau'; // ← reemplaza por el ID real de tu agente

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
              languageCode: 'es' // cambia a tu idioma si es necesario
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
