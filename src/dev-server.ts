import express from 'express';
import { templateService } from './services/template.service';
import { JobData } from './types';
import chokidar from 'chokidar';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import fs from 'fs';

const app = express();
const port = 3000;
const wsPort = 3001;

// Create WebSocket server for live reload with error handling
const wss = new WebSocketServer({ port: wsPort });

// Track connected clients
const clients = new Set<WebSocket>();

let locale = 'bg';
let currency = 'BGN';
// Enhanced WebSocket server setup
wss.on('connection', ws => {
  console.log('👋 New client connected');
  clients.add(ws);

  // Send initial connection confirmation
  ws.send('connected');

  ws.on('close', () => {
    console.log('👋 Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', error => {
    console.error('WebSocket error:', error);
  });
});

// Enhanced notification function with logging
const notifyClients = () => {
  console.log(`📢 Notifying ${clients.size} clients to reload`);
  clients.forEach(client => {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send('reload');
        console.log('✅ Reload message sent successfully');
      } else {
        console.log('⚠️ Client not ready, state:', client.readyState);
      }
    } catch (error) {
      console.error('❌ Error sending reload message:', error);
    }
  });
};

// Enhanced live reload script with debugging
const addLiveReloadScript = (html: string): string => {
  const script = `
    <script>
      (function() {
        let ws;
        const connect = () => {
          console.log('Attempting WebSocket connection...');
          ws = new WebSocket('ws://localhost:${wsPort}');
          
          ws.onopen = () => {
            console.log('WebSocket connected successfully');
          };
          
          ws.onmessage = (event) => {
            console.log('Received message:', event.data);
            if (event.data === 'reload') {
              console.log('Reloading page...');
              window.location.reload();
            }
          };
          
          ws.onclose = () => {
            console.log('WebSocket closed. Attempting to reconnect...');
            setTimeout(connect, 2000);
          };
          
          ws.onerror = (error) => {
            console.error('WebSocket error:', error);
          };
        };
        
        connect();
      })();
    </script>
  `;
  return html.replace('</body>', `${script}</body>`);
};

// Enable detailed logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Sample data for preview
const sampleData: JobData = {
  jobId: '123',
  invoiceId: 'INV-001',
  type: 'invoice',
  locale: 'bg',
  currency: 'BGN',
  data: {
    documentType: 'Invoice',
    documentNumber: '0000000123',
    date: new Date().toISOString(),
    dueDate: new Date().toISOString(),
    recipient: {
      name: 'ТОП МАН - ЕООД',
      vatNumber: 'BG117610653',
      identNumber: '117610653',
      city: 'София',
      address: 'ул. "Васил Левски" 123',
      representative: 'Иван Иванов',
      email: 'ivan@topman.bg',
      phone: '0888 123 456',
    },
    supplier: {
      name: 'Кей енд Ди Консулт ООД',
      vatNumber: 'BG205255868',
      identNumber: '205255868',
      city: 'Русе',
      address: 'бул. ген. Скобелев 48',
      representative: 'Богомил Кръстев',
      email: 'office@knd.bg',
      phone: '0888 888 888',
    },
    items: [
      {
        number: 1,
        description: 'Абонаментна поддръжка за период 08.03.2024-07.04.2024',
        unit: 'месец',
        quantity: 1,
        price: 99.99,
        total: 99.99,
      },
      {
        number: 2,
        description: 'Консултантски услуги',
        unit: 'час',
        quantity: 5,
        price: 79.95,
        total: 399.75,
      },
    ],
    totals: {
      taxBase: 499.74,
      vatAmount: 99.95,
      vatAmountReduced: 0,
      final: 599.69,
    },
    transaction: {
      taxEventDate: new Date().toISOString(),
      basis: 'Договор за абонаментна поддръжка №123/2024',
      description: 'Абонаментна поддръжка и консултантски услуги',
      location: 'Русе',
    },
    payment: {
      method: 'По банков път',
      banks: [
        {
          name: 'Банка 1',
          iban: 'BG12345678901234567890',
          bic: 'UNCRBGSF',
        },
        {
          name: 'Банка 2',
          iban: 'BG09876543210987654321',
          bic: 'RZBBBGSF',
        },
      ],
    },
  },
};

// Add error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('Server error:', err);
    res.status(500).send(`Server error: ${err.message}`);
  },
);

app.get('/', async (req, res) => {
  locale = (req.query.locale as string) || 'bg';
  currency = (req.query.currency as string) || 'BGN';
  sampleData.type = 'invoice';
  sampleData.data.totals.final = 240;
  sampleData.locale = locale;
  sampleData.currency = currency;

  try {
    console.log('Initializing template service...');

    await templateService.initialize();

    console.log('Rendering template...');
    const html = await templateService.render(sampleData);

    console.log('Sending response...');
    res.send(addLiveReloadScript(html));
  } catch (error) {
    console.error('Error handling request:', error);
    res
      .status(500)
      .send(error instanceof Error ? error.message : 'Unknown error occurred');
  }
});

app.get('/protocol', async (req, res) => {
  locale = (req.query.locale as string) || 'bg';
  currency = (req.query.currency as string) || 'BGN';
  sampleData.type = 'protocol';
  sampleData.data.totals.final = 200;
  sampleData.locale = locale;
  sampleData.currency = currency;

  try {
    console.log('Initializing template service for protocol...');
    await templateService.initialize();

    console.log('Rendering protocol template...');
    const html = await templateService.render(sampleData);

    console.log('Sending protocol response...');
    res.send(addLiveReloadScript(html));
  } catch (error) {
    console.error('Error handling protocol request:', error);
    res
      .status(500)
      .send(error instanceof Error ? error.message : 'Unknown error occurred');
  }
});

// Debug current directory and template paths
const projectRoot = process.cwd();
const templatesDir = path.join(projectRoot, 'src', 'templates');

console.log('Project root:', projectRoot);
console.log('Templates directory:', templatesDir);

// Test if directories exist
if (fs.existsSync(templatesDir)) {
  console.log('✅ Templates directory exists');
} else {
  console.error('❌ Templates directory not found!');
}

// Watch the templates directory
const watcher = chokidar.watch(templatesDir, {
  persistent: true,
  ignoreInitial: false,
  usePolling: true,
  interval: 1000,
});

// Debug events with more verbose logging
watcher
  .on('ready', () => {
    console.log('🔍 Watcher ready. Watched paths:');
    const watched = watcher.getWatched();
    Object.keys(watched).forEach(dir => {
      console.log(`Directory: ${dir}`);
      console.log(`Files: ${watched[dir].join(', ')}`);
    });
  })
  .on('all', (event, path) => {
    console.log(`🔄 Event '${event}' detected on: ${path}`);
  })
  .on('change', async changedPath => {
    console.log('📝 File changed:', changedPath);
    try {
      await templateService.initialize();
      console.log('🔄 Templates reloaded successfully');
      console.log('🔔 Triggering client reload...');
      notifyClients();
    } catch (error) {
      console.error('❌ Error reloading templates:', error);
    }
  })
  .on('add', path => console.log('➕ File added:', path))
  .on('unlink', path => console.log('➖ File removed:', path))
  .on('error', error => console.error('⚠️ Watcher error:', error));

// Test file watching
setTimeout(() => {
  console.log(
    '🔍 Currently watched paths:',
    JSON.stringify(watcher.getWatched(), null, 2),
  );
}, 2000);

// Start the server
const server = app.listen(port, () => {
  console.log(`Template preview server running at http://localhost:${port}`);
  console.log('Press Ctrl+C to stop');
});

// Handle server errors
server.on('error', error => {
  console.error('Server error:', error);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down gracefully...');
  wss.close(() => {
    console.log('WebSocket server closed');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Log WebSocket server status
wss.on('listening', () => {
  console.log(`🚀 WebSocket server running on ws://localhost:${wsPort}`);
});

wss.on('error', error => {
  console.error('💥 WebSocket server error:', error);
});
