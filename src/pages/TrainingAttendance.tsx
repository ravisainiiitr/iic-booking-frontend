import { useState } from "react";
import { CalendarCheck2 } from "lucide-react";
import { DemoRequestDialog } from "@/components/training/DemoRequestDialog";
import { SessionAttendancePanel } from "@/components/training/SessionAttendancePanel";
import { LoadingBlock, ModuleUnavailable, TrainingPageFrame } from "@/components/training/trainingUi";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";

export default function TrainingAttendance() {
  const { loading, menu } = useTrainingAvailability();
  const allowed = menu("training_attendance") || menu("training_workspace");
  const [demoRequestId, setDemoRequestId] = useState<number | null>(null);
  const [epoch, setEpoch] = useState(0);

  return (
    <TrainingPageFrame
      title="Training attendance"
      description="Mark attendance for training sessions and demonstrations on your equipment."
      icon={<CalendarCheck2 className="h-5 w-5" />}
      onRefresh={allowed ? () => setEpoch((n) => n + 1) : undefined}
    >
      {loading ? (
        <LoadingBlock />
      ) : !allowed ? (
        <ModuleUnavailable />
      ) : (
        <SessionAttendancePanel key={epoch} onOpenDemoRequest={setDemoRequestId} />
      )}
      <DemoRequestDialog
        requestId={demoRequestId}
        open={Boolean(demoRequestId)}
        onOpenChange={(open) => !open && setDemoRequestId(null)}
      />
    </TrainingPageFrame>
  );
}
