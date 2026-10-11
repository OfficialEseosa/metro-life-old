package app.metrolife;

import java.util.*;
import java.util.concurrent.Semaphore;

/** Bounded, expiring limits shared by login and account upgrades. No simulation monitor needed. */
final class AuthAttempts {
    private final Map<String,Deque<Long>> attempts=new HashMap<>();
    private final Semaphore work=new Semaphore(4);
    synchronized void check(String ip,String name,long now) {
        attempts.entrySet().removeIf(e->{e.getValue().removeIf(at->at<=now-60_000);return e.getValue().isEmpty();});
        GameService.require(attempts.size()<10_000,429,"Too many account attempts. Try again in a minute.");
        Deque<Long> address=attempts.computeIfAbsent("ip:"+ip,k->new ArrayDeque<>()),user=attempts.computeIfAbsent("name:"+name.trim().toLowerCase(Locale.ROOT),k->new ArrayDeque<>());
        GameService.require(address.size()<20&&user.size()<8,429,"Too many account attempts. Try again in a minute.");
        address.add(now);user.add(now);
    }
    void acquire(){GameService.require(work.tryAcquire(),429,"Account sign-in is busy. Try again shortly.");}
    void release(){work.release();}
}
