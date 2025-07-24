import fetch from 'node-fetch';
import { GoogleAuth } from 'google-auth-library';

export const enviarMensaje = async (req, res) => {
  try {
    const auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log('Token:', token);

    const projectId = 'prueba-opau'; // reemplaza con tu projectId real
    const sessionId = '123456789'; // o genera un id único

    if (!req.body.message) {
      return res.status(400).json({ error: 'El mensaje es obligatorio' });
    }

    const response = await fetch(
      `https://dialogflow.googleapis.com/v2/projects/${projectId}/agent/sessions/${sessionId}:detectIntent`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.token || token}`,
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

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Error en respuesta Dialogflow:', errorBody);
      return res.status(response.status).json({ error: errorBody });
    }

    const data = await response.json();
    console.log('Respuesta Dialogflow:', data);

    res.json({
      fulfillmentText: data.queryResult?.fulfillmentText || 'No hay respuesta',
      raw: data
    });
  } catch (error) {
    console.error('Error en Dialogflow:', error);
    res.status(500).json({ error: 'Error al conectarse con Dialogflow' });
  }
};

