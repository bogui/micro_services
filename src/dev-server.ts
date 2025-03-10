import express from 'express';
import { templateService } from './services/template.service';
import { generatePDF } from './services/pdf.service';
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
  jobId: '1',
  invoiceId: '1',
  type: 'invoice',
  subType: 'original',
  isCreditOrDebit: false,
  data: {
    documentNumber: '0000000605',
    date: '2025-02-07T12:04:37.568557+00:00',
    noVat: false,
    noVatCause: 'Чл. 53 / ЗДДС - износ на стоки и услуги в европейския съюз',
    supplier: {
      name: 'Кей Енд Ди Консулт - ООД',
      address: 'Ул. Ген. Скобелев  №48 вх.4 ет.6 ап.17',
      city: 'Русе',
      vatNumber: 'BG205255868',
      identNumber: '205255868',
      representative: 'Богомил Кръстев',
    },
    relatedDocument: {
      documentNumber: '0000000604',
      date: '2025-02-07T12:04:37.568557+00:00',
    },
    recipient: {
      name: 'ТОП МАН - ЕООД',
      address: 'ул. Потсдам  №10 обл.РУСЕ',
      city: 'гр.РУСЕ, 7000',
      vatNumber: 'BG117610653',
      identNumber: '117610653',
      representative: 'Мартин Данчев Йорданов',
    },
    items: [
      {
        number: 1,
        description: 'Консултантски услуги',
        unit: 'час',
        quantity: 10,
        price: 85.5,
        total: 855.0,
      },
      {
        number: 2,
        description: 'Разработка на софтуер',
        unit: 'час',
        quantity: 20,
        price: 95.0,
        total: 1900.0,
      },
      {
        number: 3,
        description: 'Поддръжка на системи',
        unit: 'мес.',
        quantity: 1,
        price: 450.0,
        total: 450.0,
      },
      {
        number: 4,
        description: 'Хостинг услуги',
        unit: 'мес.',
        quantity: 12,
        price: 29.99,
        total: 359.88,
      },
      {
        number: 5,
        description: 'SSL Сертификат',
        unit: 'бр.',
        quantity: 1,
        price: 149.99,
        total: 149.99,
      },
      {
        number: 6,
        description: 'Домейн регистрация',
        unit: 'год.',
        quantity: 2,
        price: 25.0,
        total: 50.0,
      },
      {
        number: 7,
        description: 'Обучение на персонал',
        unit: 'час',
        quantity: 8,
        price: 75.0,
        total: 600.0,
      },
      {
        number: 8,
        description: 'Анализ на данни',
        unit: 'бр.',
        quantity: 1,
        price: 750.0,
        total: 750.0,
      },
      {
        number: 9,
        description: 'SEO оптимизация',
        unit: 'мес.',
        quantity: 3,
        price: 299.99,
        total: 899.97,
      },
      {
        number: 10,
        description: 'Backup услуги',
        unit: 'мес.',
        quantity: 12,
        price: 19.99,
        total: 239.88,
      },
      {
        number: 11,
        description: 'Email хостинг',
        unit: 'год.',
        quantity: 1,
        price: 120.0,
        total: 120.0,
      },
      {
        number: 12,
        description: 'Техническа поддръжка',
        unit: 'час',
        quantity: 5,
        price: 65.0,
        total: 325.0,
      },
      {
        number: 13,
        description: 'Сигурностен одит',
        unit: 'бр.',
        quantity: 1,
        price: 899.99,
        total: 899.99,
      },
      {
        number: 14,
        description: 'Мониторинг система',
        unit: 'мес.',
        quantity: 6,
        price: 49.99,
        total: 299.94,
      },
      {
        number: 15,
        description: 'API интеграция',
        unit: 'бр.',
        quantity: 2,
        price: 450.0,
        total: 900.0,
      },
      {
        number: 16,
        description: 'Дизайн услуги',
        unit: 'час',
        quantity: 15,
        price: 65.0,
        total: 975.0,
      },
      {
        number: 17,
        description: 'Миграция на данни',
        unit: 'бр.',
        quantity: 1,
        price: 1200.0,
        total: 1200.0,
      },
      {
        number: 18,
        description: 'Тестване на софтуер',
        unit: 'час',
        quantity: 25,
        price: 45.0,
        total: 1125.0,
      },
      {
        number: 19,
        description: 'Документация',
        unit: 'стр.',
        quantity: 50,
        price: 15.0,
        total: 750.0,
      },
      {
        number: 20,
        description: 'Проектен мениджмънт',
        unit: 'час',
        quantity: 30,
        price: 75.0,
        total: 2250.0,
      },
    ],
    totals: {
      taxBase: 15099.65,
      vatAmount: 3019.93,
      vatAmountReduced: 0,
      final: 18119.58,
    },
    transaction: {
      taxEventDate: '2025-02-07T12:04:37.561',
      basis: null,
      description: null,
      location: 'гр.РУСЕ, 7000',
    },
    payment: {
      method: 'bank',
      banks: [
        {
          name: 'Банка на име',
          iban: 'IBAN',
          bic: 'BIC',
        },
        {
          name: 'Банка на име 2',
          iban: 'IBAN 2',
          bic: 'BIC 2',
        },
      ],
    },
    inWords:
      'Сто осемдесет и една хиляди сто деветдесет и пет лева и осемдесет и осем стотин лева',
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
  const type = req.query.type || 'invoice';
  const noVat = req.query.noVat === 'true' || false;
  const subType = req.query.subType || 'original';
  const vatResponse = req.query.vatResponse || null;
  const pdf = req.query.pdf || false;
  const annuledAt = req.query.annuledAt || null;

  sampleData.data.noVat = noVat;

  if (vatResponse) {
    sampleData.data.vatResponse = {
      address: 'ул. Потсдам  №10 обл.РУСЕ',
      countryCode: 'BG',
      name: 'ТОП МАН - ЕООД',
      valid: false,
      vatNumber: 'BG117610653',
      requestDate: '2025-02-07T12:04:37.568557+00:00',
    };
  }

  if (type === 'credit' || type === 'debit') {
    sampleData.isCreditOrDebit = true;
  }

  if (annuledAt) {
    console.log('annuledAt', annuledAt);
    sampleData.data.annuledAt = annuledAt as string;
  }

  sampleData.type = type as 'invoice' | 'credit' | 'debit' | 'protocol';
  sampleData.subType = subType as 'original' | 'copy';
  sampleData.locale = locale;
  sampleData.currency = currency;

  try {
    console.log('Initializing template service...');

    await templateService.initialize();

    if (pdf) {
      const pdfData = await generatePDF(sampleData);
      res.send(pdfData);
      return;
    }

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
