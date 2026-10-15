import { connectDatabase } from '../config/db';
import { Workspace } from '../models/Workspace';

async function updateLimits() {
  await connectDatabase();
  const res = await Workspace.updateMany(
    {},
    {
      $set: {
        'limits.locations': 10,
        'limits.seats': 5,
        'limits.scanCredits': 100,
        'limits.aiCredits': 50,
      },
    }
  );
  console.log(`✅ Updated ${res.modifiedCount} workspace(s) with 10 locations quota and 100 scan credits.`);
  process.exit(0);
}

updateLimits().catch((err) => {
  console.error(err);
  process.exit(1);
});
