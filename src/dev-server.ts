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
    documentNumber: 'INV-001',
    invoiceNumber: 'INV-001',
    date: new Date().toISOString(),
    dueDate: new Date().toISOString(),
    subtotal: 200,
    tax: 40,
    total: 240,
    clientDetails: {
      name: 'Sample Client',
      address: 'Sample Address',
      email: 'sample@client.com',
    },
    companyDetails: {
      phone: '123-456-7890',
      name: 'Your Company',
      address: 'Company Address',
      email: 'company@example.com',
    },
    items: [
      {
        description: 'Sample Item 1',
        quantity: 2,
        unitPrice: 100,
        total: 200,
      },
    ],
  },
};

// Add error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error('Server error:', err);
    res.status(500).send(`Server error: ${err.message}`);
  },
);

app.get('/', async (req, res) => {
  locale = (req.query.locale as string) || 'bg';
  currency = (req.query.currency as string) || 'BGN';
  sampleData.type = 'invoice';
  sampleData.data.total = 240;
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
  sampleData.data.total = 200;
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
