import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { ITaskQueue, BillingTask } from '../../domain/services/task-queue.interface';

/**
 * RabbitMQ task queue implementation
 * Provides reliable task queuing with retry capabilities using RabbitMQ
 */
@Injectable()
export class RabbitMQTaskQueue implements ITaskQueue, OnModuleInit, OnModuleDestroy {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly mainQueue = 'billing_tasks';
  private readonly retryQueue = 'billing_retry';
  private readonly deadLetterExchange = 'billing_dlx';
  private consumerTag: string | null = null;

  async onModuleInit() {
    await this.connect();
    await this.setupQueues();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Get queue name
   */
  getQueueName(): string {
    return 'rabbitmq';
  }

  /**
   * Publish a task to the queue
   * @param task Task to publish
   * @param delayMs Optional delay in milliseconds
   */
  async publishTask(task: BillingTask, delayMs?: number): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    const message = JSON.stringify(task);
    const buffer = Buffer.from(message);

    if (delayMs && delayMs > 0) {
      // Use retry queue with TTL for delayed messages
      await this.channel.sendToQueue(this.retryQueue, buffer, {
        messageTtl: delayMs,
        persistent: true
      });
    } else {
      // Send to main queue
      await this.channel.sendToQueue(this.mainQueue, buffer, {
        persistent: true
      });
    }
  }

  /**
   * Start consuming tasks from the queue
   * @param handler Function to process each task
   */
  async consumeTasks(handler: (task: BillingTask) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    const { consumerTag } = await this.channel.consume(this.mainQueue, async (msg) => {
      if (msg && this.channel) {
        try {
          const task: BillingTask = JSON.parse(msg.content.toString());
          await handler(task);
          this.channel!.ack(msg);
        } catch (error) {
          console.error('Task processing failed:', error);
          // Reject the message and don't requeue (let it go to dead letter queue if configured)
          this.channel!.nack(msg, false, false);
        }
      }
    });

    this.consumerTag = consumerTag;
  }

  /**
   * Acknowledge successful task processing
   * @param taskId Task ID to acknowledge
   */
  async acknowledgeTask(taskId: string): Promise<void> {
    // RabbitMQ handles acknowledgment in the consume callback
    // This method is here for interface compliance
  }

  /**
   * Reject a task
   * @param taskId Task ID to reject
   * @param requeue Whether to requeue the task
   */
  async rejectTask(taskId: string, requeue: boolean): Promise<void> {
    // RabbitMQ handles rejection in the consume callback
    // This method is here for interface compliance
  }

  /**
   * Connect to RabbitMQ
   */
  private async connect(): Promise<void> {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      console.log('Connected to RabbitMQ');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Disconnect from RabbitMQ
   */
  private async disconnect(): Promise<void> {
    try {
      if (this.consumerTag && this.channel) {
        await this.channel.cancel(this.consumerTag);
      }

      if (this.channel) {
        await this.channel.close();
      }

      if (this.connection) {
        await this.connection.close();
      }

      console.log('Disconnected from RabbitMQ');
    } catch (error) {
      console.error('Error disconnecting from RabbitMQ:', error);
    }
  }

  /**
   * Setup queues and exchanges
   */
  private async setupQueues(): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    // Declare dead letter exchange
    await this.channel.assertExchange(this.deadLetterExchange, 'direct', { durable: true });

    // Declare main queue with dead letter exchange
    await this.channel.assertQueue(this.mainQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.deadLetterExchange,
        'x-dead-letter-routing-key': this.mainQueue
      }
    });

    // Declare retry queue with TTL and dead letter exchange
    await this.channel.assertQueue(this.retryQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.deadLetterExchange,
        'x-dead-letter-routing-key': this.mainQueue,
        'x-message-ttl': 3600000 // 1 hour default TTL
      }
    });

    // Bind queues to dead letter exchange
    await this.channel.bindQueue(this.mainQueue, this.deadLetterExchange, this.mainQueue);

    console.log('RabbitMQ queues and exchanges setup complete');
  }
}