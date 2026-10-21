package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** A job is part of a day, rather than an endlessly repeatable money button. */
final class CareerRhythm {
 private CareerRhythm(){}
 static int[] hours(String track){return new int[]{0,24};}
 static boolean job(JsonNode a){return a.path("requires").has("job");}
 static boolean gig(JsonNode a){return !job(a)&&a.path("kind").asText().equals("work")&&a.path("pay").asDouble()>0;}
 static int day(GameService g,ObjectNode s,ObjectNode w){return g.scheduleClock(s,w).path("day").asInt();}
 static int gigs(GameService g,ObjectNode s,ObjectNode w){JsonNode saved=s.path("_workRhythm");return saved.path("gigsDay").asInt(-1)==day(g,s,w)?saved.path("gigs").asInt():0;}
 static String window(String track){return "Whenever your workplace is open";}
 static String jobReason(GameService g,ObjectNode s,ObjectNode w){if(!s.path("job").isObject())return "Apply for a job first";if(s.path("_workRhythm").path("lastShiftDay").asInt(-1)==day(g,s,w))return "Your paid shift is done for today. Come back tomorrow.";return "";}
 static void validate(GameService g,ObjectNode s,ObjectNode w,JsonNode a){if(job(a)){String reason=jobReason(g,s,w);GameService.require(reason.isEmpty(),409,reason);}else if(gig(a))GameService.require(gigs(g,s,w)<3,409,"You have finished three paid gigs today. Explore, rest or meet a neighbour until tomorrow.");}
 /** Zero delegates ordinary activities to the existing action duration. */
 static long duration(GameService g,ObjectNode s,ObjectNode w,JsonNode a){return job(a)?25000:gig(a)?18000:0;}
 /** Call only after the durable activity settles. Cancelling leaves both allowances available. */
 static void settled(GameService g,ObjectNode s,ObjectNode w,JsonNode pending){ObjectNode saved=s.withObject("_workRhythm");int today=day(g,s,w);if(pending.path("shift").asBoolean()){saved.put("lastShiftDay",today).put("lastShiftAt",g.now());return;}boolean paidGig=pending.path("paidGig").asBoolean()||pending.path("kind").asText().equals("work")&&pending.path("activity").path("pay").asDouble()>0;if(paidGig){int count=gigs(g,s,w);saved.put("gigsDay",today).put("gigs",count+1);}}
 static ObjectNode snapshot(GameService g,ObjectNode s,ObjectNode w){String track=s.path("job").path("track").asText();int[] hours=hours(track);String reason=jobReason(g,s,w);if(s.path("busyUntil").asLong()>g.now())reason="Finish your current activity first";else if(s.path("pendingBeat").isObject())reason="Choose your story first";return g.object().put("open",hours[0]).put("close",hours[1]).put("lastDay",s.path("_workRhythm").path("lastShiftDay").asInt(-1)).put("canWork",reason.isEmpty()).put("reason",reason).put("gigsToday",gigs(g,s,w)).put("gigLimit",3).put("shiftGameMinutes",Math.round(25000/g.minuteMillis(w))).put("gigGameMinutes",Math.round(18000/g.minuteMillis(w))).put("shiftSeconds",25).put("hoursLabel",window(track));}
}
