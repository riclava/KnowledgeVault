import { PhaseShell } from "@/components/app/phase-shell";
import { AccountPanel } from "@/components/account/account-panel";
import { getCurrentLearner } from "@/server/auth/current-learner";

function sanitizeReturnTo(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/review";
  }

  return value;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const current = await getCurrentLearner();
  const returnTo = sanitizeReturnTo(params.returnTo);
  const signedInEmail = current?.authSession?.user.email ?? null;

  return (
    <PhaseShell
      activePath="/account"
      eyebrow="账号"
      title={current ? "账号" : "登录"}
      description={current ? "查看当前账号或退出登录。" : "登录后继续刚才的训练。"}
      density="compact"
    >
      <div className="max-w-xl">
        <AccountPanel
          authenticated={Boolean(current)}
          email={signedInEmail}
          returnTo={returnTo}
        />
      </div>
    </PhaseShell>
  );
}
