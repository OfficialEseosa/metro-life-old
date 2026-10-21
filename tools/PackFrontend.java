import java.nio.file.*;
import java.util.zip.*;
public class PackFrontend {
 public static void main(String[] args)throws Exception{
  Path root=Path.of("").toAbsolutePath(),dist=root.resolve("frontend/dist"),zip=root.resolve("tools/frontend.zip"),temporary=zip.resolveSibling("frontend.zip.tmp");
  if(!Files.isRegularFile(dist.resolve("index.html")))throw new IllegalStateException("Build the frontend first");
  try(var output=new ZipOutputStream(Files.newOutputStream(temporary));var paths=Files.walk(dist)){
   for(Path path:paths.filter(Files::isRegularFile).sorted().toList()){
    String entry=dist.relativize(path).toString().replace('\\','/');if(entry.startsWith("models/"))continue;
    ZipEntry e=new ZipEntry(entry);e.setTime(0);output.putNextEntry(e);Files.copy(path,output);output.closeEntry();
   }
  }
  try{Files.move(temporary,zip,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);}catch(AtomicMoveNotSupportedException e){Files.move(temporary,zip,StandardCopyOption.REPLACE_EXISTING);}
  System.out.println("Bundled frontend: "+Files.size(zip)+" bytes");
 }
}
