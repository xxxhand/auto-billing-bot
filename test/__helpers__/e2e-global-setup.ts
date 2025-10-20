/** Load environment variables */
import * as dotenv from 'dotenv';
import { expand } from 'dotenv-expand';
// 這是為了在env檔可以用${...}的方式
expand({ parsed: dotenv.config().parsed });
/** Load environment variables */

export default () => {
  // Set test db uri
  process.env.DEFAULT_MONGO_URI = 'mongodb://localhost:27017/my_db_subscription';
  process.env.DEFAULT_MONGO_DB_NAME = 'subscription';
  console.log(`Run e2e tests with db ${process.env.DEFAULT_MONGO_URI}/${process.env.DEFAULT_MONGO_DB_NAME}`);
};
