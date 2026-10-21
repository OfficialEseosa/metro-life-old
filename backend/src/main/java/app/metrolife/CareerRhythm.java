package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** A job is part of a day, rather than an endlessly repeatable money button. */
final class CareerRhythm {
 private CareerRhythm(){}
 static int[] hours(String track){return switch(track){case "tech"->new int[]{9,18};case "music"->new int[]{17,2};case "food"->new int[]{8,22};case "sports"->new int[]{10,22};case "health"->new int[]{6,22};case "civic"->new int[]{9,17};case "finance"->new int[]{8,17};case "arts"->new int[]{10,20};default->new int[]{9,18};};}
 static boolean job(JsonNode a){return a.path("requires").has("job");}
 static boolean gig(JsonNode a){return !job(a)&&a.path("kind").asText().equals("work")&&a.path("pay").asDouble()>0;}
 static int day(GameService g,ObjectNode w){return g.clock(w).path("day").asInt();}
 static int gigs(GameService g,ObjectNode s,ObjectNode w){JsonNode saved=s.path("_workRhythm");return saved.path("gigsDay").asInt(-1)==day(g,w)?saved.path("gigs").asInt():0;}
 static String window(String track){int[] hours=hours(track);return String.format("%02d:00–%02d:00",hours[0],hours[1]);}
 static String jobReason(GameService g,ObjectNode s,ObjectNode w){if(!s.path("job").isObject())return "Apply for a job first";int today=day(g,w);if(s.path("_workRhythm").path("lastShiftDay").asInt(-1)==today)return "Your paid shift is done for today. Come back tomorrow.";int[] hours=hours(s.path("job").path("track").asText());JsonNode clock=g.clock(w);double hour=clock.path("hour").asDouble()+clock.path("minute").asDouble()/60,at=hour,close=hours[1];if(hours[1]<=hours[0]){close+=24;if(at<hours[0])at+=24;}if(at<hours[0]||at>=close)return "Your work hours are "+window(s.path("job").path("track").asText());if(close-at<4-.0001)return "A shift takes four game hours. Return when work opens at "+String.format("%02d:00",hours[0])+".";return "";}
 static void validate(GameService g,ObjectNode s,ObjectNode w,JsonNode a){if(job(a)){String reason=jobReason(g,s,w);GameService.require(reason.isEmpty(),409,reason);}else if(gig(a))GameService.require(gigs(g,s,w)<3,409,"You have finished three paid gigs today. Explore, rest or meet a neighbour until tomorrow.");}
 /** Zero delegates ordinary activities to the existing action duration. */
 static long duration(GameService g,ObjectNode s,ObjectNode w,JsonNode a){return job(a)?Math.max(1000,Math.round(240*g.minuteMillis(w))):gig(a)?Math.max(1000,Math.round(60*g.minuteMillis(w))):0;}
 /** Call only after the durable activity settles. Cancelling leaves both allowances available. */
 static void settled(GameService g,ObjectNode s,ObjectNode w,JsonNode pending){ObjectNode saved=s.withObject("_workRhythm");int today=day(g,w);if(pending.path("shift").asBoolean()){saved.put("lastShiftDay",today).put("lastShiftAt",g.now());return;}boolean paidGig=pending.path("paidGig").asBoolean()||pending.path("kind").asText().equals("work")&&pending.path("activity").path("pay").asDouble()>0;if(paidGig){int count=gigs(g,s,w);saved.put("gigsDay",today).put("gigs",count+1);}}
 static ObjectNode snapshot(GameService g,ObjectNode s,ObjectNode w){String track=s.path("job").path("track").asText();int[] hours=hours(track);String reason=jobReason(g,s,w);if(s.path("busyUntil").asLong()>g.now())reason="Finish your current activity first";else if(s.path("pendingBeat").isObject())reason="Choose your story first";return g.object().put("open",hours[0]).put("close",hours[1]).put("lastDay",s.path("_workRhythm").path("lastShiftDay").asInt(-1)).put("canWork",reason.isEmpty()).put("reason",reason).put("gigsToday",gigs(g,s,w)).put("gigLimit",3).put("shiftGameMinutes",240).put("gigGameMinutes",60).put("shiftSeconds",Math.round(240*g.minuteMillis(w)/1000.0)).put("hoursLabel",window(track));}
}
